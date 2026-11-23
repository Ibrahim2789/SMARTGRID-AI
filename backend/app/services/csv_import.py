"""
SmartGrid AI — Production CSV & Tabular Import Service
Provides:
  - Strict RFC-4180 / delimited CSV parsing with malformed-quote, binary, empty, and size checks
  - Category schemas, downloadable CSV templates, and synonym-based column mapping with confidence scores
  - Full server-side validation (required fields, types, bounds, booleans, emails, in-file duplicates, DB duplicates, FKs)
  - Field-level diff previews for 'update' duplicate mode
  - Staged batch execution with compensating rollback, idempotency protection, and persistent import_history logging
  - RFC-4180 error report CSV generation preserving original source columns
"""

from __future__ import annotations

import csv
import hashlib
import io
import re
import time
import uuid
from collections import defaultdict
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from app.database.supabase import SupabaseQueryError
from database import now_iso

MAX_IMPORT_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_IMPORT_ROWS = 10_000
BATCH_CHUNK_SIZE = 200

VALID_CATEGORIES = (
    "all",
    "departments",
    "rooms",
    "laboratories",
    "instructors",
    "courses",
    "cohorts",
    "enrollments",
    "course_assignments",
)

VALID_DUPLICATE_MODES = ("skip", "update", "stop")
ADMIN_IMPORT_ROLES = ["admin", "university_admin", "super_admin", "timetable_manager"]

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class CsvParseError(Exception):
    def __init__(self, message: str, line: Optional[int] = None) -> None:
        super().__init__(message)
        self.message = message
        self.line = line


def _normalize_header(raw: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", raw.strip().lower()).strip("_")


# ---------------------------------------------------------------------------
# Category Definitions, Fields & Synonym Dictionaries
# ---------------------------------------------------------------------------

CATEGORY_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "departments": {
        "title": "Departments",
        "description": "Academic departments, schools/faculties, department heads, and internal wings.",
        "stableKey": "code",
        "fields": [
            {"key": "code", "label": "Department Code", "required": True, "type": "string", "synonyms": ["dept_code", "department_code", "code", "dept", "department_id"]},
            {"key": "name", "label": "Department Name", "required": True, "type": "string", "synonyms": ["dept_name", "department_name", "name", "department", "title"]},
            {"key": "school", "label": "School / Faculty", "required": False, "type": "string", "synonyms": ["school", "faculty", "faculty_name", "faculty_group", "division", "college"]},
            {"key": "headOfDepartment", "label": "Head of Department", "required": False, "type": "string", "synonyms": ["head_of_department", "hod", "chair", "chairperson", "head"]},
            {"key": "subDepartments", "label": "Sub-Departments / Tracks", "required": False, "type": "list", "synonyms": ["sub_departments", "sub_department", "subdepartments", "tracks", "wings", "specializations"]},
        ],
        "templateHeaders": ["code", "name", "school", "head_of_department", "sub_departments"],
        "templateRows": [
            ["CS", "Computer Science", "School of Computing", "Dr. Alan Turing", "Artificial Intelligence; Systems; Software Engineering"],
            ["EE", "Electrical Engineering", "School of Engineering", "Dr. Nikola Tesla", "Power Systems; Electronics"],
        ],
    },
    "rooms": {
        "title": "Classrooms & Lecture Halls",
        "description": "Physical classrooms, seminar rooms, and lecture auditoriums with capacities and equipment.",
        "stableKey": "code",
        "fields": [
            {"key": "code", "label": "Room Code", "required": True, "type": "string", "synonyms": ["room_code", "code", "room", "classroom", "classroom_code", "hall", "room_no", "room_number"]},
            {"key": "name", "label": "Room Name", "required": False, "type": "string", "synonyms": ["room_name", "name", "hall_name", "title", "classroom_name"]},
            {"key": "capacity", "label": "Seating Capacity", "required": True, "type": "int", "synonyms": ["capacity", "room_capacity", "seats", "max_students", "cap"]},
            {"key": "type", "label": "Room Type (lecture/seminar/auditorium)", "required": False, "type": "enum:lecture,seminar,auditorium", "synonyms": ["room_type", "type", "kind", "classroom_type"]},
            {"key": "building", "label": "Building Name", "required": False, "type": "string", "synonyms": ["building", "building_name", "block", "location", "wing"]},
            {"key": "floor", "label": "Floor Number", "required": False, "type": "int", "synonyms": ["floor", "floor_no", "level"]},
            {"key": "equipment", "label": "Equipment List", "required": False, "type": "list", "synonyms": ["equipment", "features", "amenities", "facilities", "resources"]},
            {"key": "isAvailable", "label": "Is Available (yes/no)", "required": False, "type": "bool", "synonyms": ["is_available", "available", "active", "status"]},
        ],
        "templateHeaders": ["code", "name", "building", "floor", "capacity", "type", "equipment", "is_available"],
        "templateRows": [
            ["HALL-101", "Alan Turing Lecture Hall", "Academic Block A", "1", "70", "lecture", "Projector; Whiteboard; Audio System", "yes"],
            ["SEM-204", "Euler Seminar Room", "Academic Block A", "2", "35", "seminar", "SmartBoard; Projector", "yes"],
        ],
    },
    "laboratories": {
        "title": "Laboratories",
        "description": "Specialized computing, hardware, and engineering laboratories with seating capacity and assigned lab engineers.",
        "stableKey": "code",
        "fields": [
            {"key": "code", "label": "Lab Code", "required": True, "type": "string", "synonyms": ["lab_code", "code", "room_code", "laboratory_code", "lab", "facility_code"]},
            {"key": "name", "label": "Laboratory Name", "required": True, "type": "string", "synonyms": ["lab_name", "name", "laboratory_name", "facility_name", "title"]},
            {"key": "capacity", "label": "Lab Seating Capacity", "required": True, "type": "int", "synonyms": ["capacity", "seats", "workstations", "lab_capacity", "max_students"]},
            {"key": "building", "label": "Building Name", "required": False, "type": "string", "synonyms": ["building", "building_name", "block", "location"]},
            {"key": "labCategory", "label": "Lab Category", "required": False, "type": "string", "synonyms": ["lab_category", "category", "discipline", "lab_type"]},
            {"key": "departmentCode", "label": "Department Code", "required": False, "type": "fk:department", "synonyms": ["department_code", "dept_code", "department", "dept"]},
            {"key": "assignedLabEngineer", "label": "Assigned Lab Engineer (email or name)", "required": False, "type": "fk:instructor", "synonyms": ["assigned_lab_engineer", "lab_engineer", "lab_engineer_email", "engineer", "supervisor"]},
            {"key": "equipment", "label": "Equipment List", "required": False, "type": "list", "synonyms": ["equipment", "resources", "hardware", "features"]},
            {"key": "isAvailable", "label": "Is Available (yes/no)", "required": False, "type": "bool", "synonyms": ["is_available", "available", "active"]},
        ],
        "templateHeaders": ["code", "name", "building", "capacity", "lab_category", "department_code", "assigned_lab_engineer", "equipment", "is_available"],
        "templateRows": [
            ["LAB-201", "Systems & Computing Lab", "Engineering Lab Complex", "45", "Computing", "CS", "", "45 Workstations; Linux Cluster; Projector", "yes"],
            ["LAB-202", "Digital Circuits Lab", "Engineering Lab Complex", "35", "Electronics", "EE", "", "Oscilloscopes; Function Generators", "yes"],
        ],
    },
    "instructors": {
        "title": "Instructors & Lab Engineers",
        "description": "Faculty members and lab engineers, department affiliations, workload caps, and qualified courses.",
        "stableKey": "email",
        "fields": [
            {"key": "name", "label": "Full Name", "required": True, "type": "string", "synonyms": ["instructor_name", "name", "faculty_name", "teacher_name", "teacher", "professor", "lecturer", "faculty"]},
            {"key": "email", "label": "Institutional Email", "required": True, "type": "email", "synonyms": ["email", "instructor_email", "faculty_email", "teacher_email", "mail", "email_address"]},
            {"key": "departmentCode", "label": "Department Code", "required": False, "type": "fk:department", "synonyms": ["department_code", "dept_code", "department", "dept"]},
            {"key": "title", "label": "Academic Designation / Title", "required": False, "type": "string", "synonyms": ["title", "designation", "rank", "position", "academic_rank"]},
            {"key": "staffRole", "label": "Staff Role (faculty/lab_engineer)", "required": False, "type": "enum:faculty,lab_engineer", "synonyms": ["staff_role", "role_type", "role", "instructor_role"]},
            {"key": "subDepartment", "label": "Sub-Department / Wing", "required": False, "type": "string", "synonyms": ["sub_department", "subdepartment", "track", "wing", "specialization"]},
            {"key": "maxWeeklyHours", "label": "Max Weekly Hours", "required": False, "type": "int", "synonyms": ["max_weekly_hours", "weekly_hours", "max_hours", "workload_cap", "weekly_cap"]},
            {"key": "maxDailyClasses", "label": "Max Daily Classes", "required": False, "type": "int", "synonyms": ["max_daily_classes", "max_lectures_per_day", "daily_cap", "max_daily"]},
            {"key": "qualifiedCourses", "label": "Qualified Course Codes", "required": False, "type": "list:fk:course", "synonyms": ["qualified_courses", "eligible_courses", "subjects", "can_teach", "specializations"]},
        ],
        "templateHeaders": ["name", "email", "department_code", "title", "staff_role", "sub_department", "max_weekly_hours", "max_daily_classes", "qualified_courses"],
        "templateRows": [
            ["Dr. Sarah Chen", "sarah.chen@university.edu", "CS", "Associate Professor", "faculty", "Artificial Intelligence", "14", "3", "CS-101; CS-201"],
            ["Engr. Bilal Tariq", "bilal.tariq@university.edu", "CS", "Senior Lab Engineer", "lab_engineer", "Systems", "18", "4", "CS-101"],
        ],
    },
    "courses": {
        "title": "Courses",
        "description": "Academic catalog courses with lecture/lab credit hours, departments, compulsory/elective flags, and staff bindings.",
        "stableKey": "code",
        "fields": [
            {"key": "code", "label": "Course Code", "required": True, "type": "string", "synonyms": ["course_code", "code", "subject_code", "course_id", "course_no", "subject_id"]},
            {"key": "title", "label": "Course Title", "required": True, "type": "string", "synonyms": ["title", "course_title", "course_name", "subject", "subject_name", "name"]},
            {"key": "departmentCode", "label": "Department Code", "required": True, "type": "fk:department", "synonyms": ["department_code", "dept_code", "department", "dept"]},
            {"key": "courseType", "label": "Course Type (lecture/lab/lecture_lab)", "required": False, "type": "enum:lecture,lab,lecture_lab", "synonyms": ["course_type", "type", "category", "mode"]},
            {"key": "creditHours", "label": "Total Credit Hours", "required": False, "type": "int", "synonyms": ["credit_hours", "credits", "credit", "cr_hrs", "units"]},
            {"key": "lectureCredits", "label": "Lecture Credits", "required": False, "type": "int", "synonyms": ["lecture_credits", "theory_credits", "lec_credits", "lec_cr", "lecture_credit_hours"]},
            {"key": "labCredits", "label": "Lab Credits", "required": False, "type": "int", "synonyms": ["lab_credits", "practical_credits", "lab_cr", "lab_credit_hours"]},
            {"key": "labSessionMode", "label": "Lab Session Mode (continuous/split_allowed)", "required": False, "type": "enum:continuous,split_allowed", "synonyms": ["lab_session_mode", "lab_mode"]},
            {"key": "isCompulsory", "label": "Is Compulsory (yes/no)", "required": False, "type": "bool", "synonyms": ["is_compulsory", "compulsory", "mandatory", "core"]},
            {"key": "isElective", "label": "Is Elective (yes/no)", "required": False, "type": "bool", "synonyms": ["is_elective", "elective", "optional"]},
            {"key": "electivePoolName", "label": "Elective Pool Name", "required": False, "type": "string", "synonyms": ["elective_pool", "elective_pool_name", "pool_name"]},
            {"key": "assignedInstructor", "label": "Assigned Instructor (email or name)", "required": False, "type": "fk:instructor", "synonyms": ["assigned_instructor", "instructor", "instructor_email", "instructor_name", "teacher", "teacher_name", "faculty_name"]},
            {"key": "assignedLabEngineer", "label": "Assigned Lab Engineer (email or name)", "required": False, "type": "fk:instructor", "synonyms": ["assigned_lab_engineer", "lab_engineer", "lab_engineer_email"]},
            {"key": "requiredEquipment", "label": "Required Equipment", "required": False, "type": "list", "synonyms": ["required_equipment", "equipment", "lab_equipment"]},
            {"key": "subDepartment", "label": "Sub-Department / Wing", "required": False, "type": "string", "synonyms": ["sub_department", "subdepartment", "track"]},
            {"key": "semester", "label": "Semester (1–16)", "required": False, "type": "int", "synonyms": ["semester", "course_semester", "semester_number", "sem", "term_number"]},
        ],
        "templateHeaders": ["code", "title", "department_code", "course_type", "lecture_credits", "lab_credits", "semester", "is_elective", "assigned_instructor", "assigned_lab_engineer", "required_equipment"],
        "templateRows": [
            ["CS-101", "Programming Fundamentals", "CS", "lecture_lab", "3", "1", "1", "no", "", "", "Projector; Workstations"],
            ["CS-401", "Artificial Intelligence", "CS", "lecture", "3", "0", "7", "yes", "", "", "Projector"],
        ],
    },
    "cohorts": {
        "title": "Batches & Sections",
        "description": "Student batches, degree tracks, sections (e.g. 2K24-CS-A), semesters, and class sizes.",
        "stableKey": "code",
        "fields": [
            {"key": "code", "label": "Cohort / Batch Code", "required": True, "type": "string", "synonyms": ["cohort_code", "batch_code", "code", "class_code", "section_code", "group_code"]},
            {"key": "name", "label": "Batch / Section Name", "required": False, "type": "string", "synonyms": ["cohort_name", "batch_name", "name", "section_name", "class_name", "class", "student_group"]},
            {"key": "departmentCode", "label": "Department Code", "required": True, "type": "fk:department", "synonyms": ["department_code", "dept_code", "department", "dept", "program_code"]},
            {"key": "batchCode", "label": "Intake / Batch Year Code (e.g. 2K24)", "required": False, "type": "string", "synonyms": ["intake", "batch", "batch_year", "cohort_year"]},
            {"key": "section", "label": "Section Letter(s) (e.g. A)", "required": False, "type": "string", "synonyms": ["section", "section_letter", "sections", "sections_list", "sec"]},
            {"key": "year", "label": "Academic Year (1–8)", "required": False, "type": "int", "synonyms": ["year", "study_year", "academic_year", "level"]},
            {"key": "semester", "label": "Semester (1–16)", "required": False, "type": "int", "synonyms": ["semester", "sem", "term_number"]},
            {"key": "size", "label": "Student Count", "required": True, "type": "int", "synonyms": ["student_count", "size", "cohort_size", "students", "enrollment", "headcount"]},
            {"key": "homeRoom", "label": "Home Room Code", "required": False, "type": "fk:room_or_lab", "synonyms": ["home_room", "default_room", "assigned_room"]},
        ],
        "templateHeaders": ["code", "name", "department_code", "batch_code", "section", "year", "semester", "size", "home_room"],
        "templateRows": [
            ["2K24-CS-A", "2K24 CS Section A", "CS", "2K24", "A", "2", "3", "45", ""],
            ["2K24-CS-B", "2K24 CS Section B", "CS", "2K24", "B", "2", "3", "42", ""],
        ],
    },
    "enrollments": {
        "title": "Student Enrollments",
        "description": "Course enrollments linking academic batches/sections (and optional student registration numbers) to courses.",
        "stableKey": "course_batch_section_student",
        "fields": [
            {"key": "courseCode", "label": "Course Code", "required": True, "type": "fk:course", "synonyms": ["course_code", "course", "subject_code", "course_id"]},
            {"key": "batchCode", "label": "Batch / Cohort Code", "required": True, "type": "fk:batch", "synonyms": ["batch_code", "cohort_code", "batch", "cohort", "class_code"]},
            {"key": "section", "label": "Section", "required": False, "type": "string", "synonyms": ["section", "section_code", "sec"]},
            {"key": "studentRegistrationNumber", "label": "Student Registration No (optional)", "required": False, "type": "fk:student", "synonyms": ["registration_number", "student_registration_number", "roll_no", "roll_number", "student_id", "reg_no"]},
        ],
        "templateHeaders": ["course_code", "batch_code", "section", "registration_number"],
        "templateRows": [
            ["CS-101", "2K24-CS-A", "A", ""],
            ["CS-401", "2K24-CS-B", "B", ""],
        ],
    },
    "course_assignments": {
        "title": "Course Assignments",
        "description": "Scheduling sections assigning instructors, lab engineers, weekly sessions, and room types to courses and batches.",
        "stableKey": "course_batch_section_sessionType",
        "fields": [
            {"key": "courseCode", "label": "Course Code", "required": True, "type": "fk:course", "synonyms": ["course_code", "course", "subject_code"]},
            {"key": "batchCode", "label": "Batch / Cohort Code", "required": True, "type": "fk:batch", "synonyms": ["batch_code", "cohort_code", "batch", "cohort", "class_code"]},
            {"key": "sectionCode", "label": "Section Code", "required": False, "type": "string", "synonyms": ["section_code", "section", "sec"]},
            {"key": "instructor", "label": "Instructor (email or name)", "required": True, "type": "fk:instructor", "synonyms": ["instructor", "instructor_email", "instructor_name", "teacher", "teacher_name", "faculty", "faculty_name"]},
            {"key": "labEngineer", "label": "Lab Engineer (email or name)", "required": False, "type": "fk:instructor", "synonyms": ["lab_engineer", "lab_engineer_email", "lab_engineer_name", "assigned_lab_engineer"]},
            {"key": "sessionType", "label": "Session Type (Theory/Lab/Tutorial)", "required": False, "type": "enum:Theory,Lab,Tutorial", "synonyms": ["session_type", "type", "component_type"]},
            {"key": "sessionsPerWeek", "label": "Sessions Per Week (1–6)", "required": False, "type": "int", "synonyms": ["sessions_per_week", "weekly_sessions", "frequency"]},
            {"key": "durationMinutes", "label": "Duration Minutes (30–300)", "required": False, "type": "int", "synonyms": ["duration_minutes", "duration", "minutes"]},
            {"key": "expectedStudents", "label": "Expected Students", "required": False, "type": "int", "synonyms": ["expected_students", "enrollment", "student_count", "size"]},
            {"key": "requiredRoomType", "label": "Required Room Type (lecture/lab/seminar)", "required": False, "type": "enum:lecture,lab,seminar", "synonyms": ["required_room_type", "room_type"]},
        ],
        "templateHeaders": ["course_code", "batch_code", "section_code", "instructor", "lab_engineer", "session_type", "sessions_per_week", "duration_minutes", "expected_students", "required_room_type"],
        "templateRows": [
            ["CS-101", "2K24-CS-A", "A", "sarah.chen@university.edu", "", "Theory", "3", "50", "45", "lecture"],
            ["CS-101", "2K24-CS-A", "A", "bilal.tariq@university.edu", "bilal.tariq@university.edu", "Lab", "1", "180", "45", "lab"],
        ],
    },
}


# ---------------------------------------------------------------------------
# Strict CSV Parser & Delimiter Detector
# ---------------------------------------------------------------------------

def _validate_quotes_and_encoding(text: str) -> str:
    if not text or not text.strip():
        raise CsvParseError("The uploaded file is empty.")
    if "\x00" in text:
        raise CsvParseError("Binary or null-byte data detected. Please upload a valid UTF-8 CSV or .xlsx file.")
    if text.startswith("\ufeff"):
        text = text[1:]

    # Track RFC-4180 quote closure carefully across lines
    in_quotes = False
    quote_start_line = 1
    line_num = 1
    i = 0
    n = len(text)
    at_field_start = True
    while i < n:
        ch = text[i]
        if ch == "\r":
            if i + 1 < n and text[i + 1] == "\n":
                i += 1
            if not in_quotes:
                at_field_start = True
            line_num += 1
        elif ch == "\n":
            if not in_quotes:
                at_field_start = True
            line_num += 1
        elif ch == '"':
            if in_quotes:
                if i + 1 < n and text[i + 1] == '"':
                    i += 1  # escaped quote ""
                else:
                    in_quotes = False
                    # After closing quote, only delimiter, whitespace, CR/LF, or EOF is valid
                    j = i + 1
                    while j < n and text[j] in (" ", "	"):
                        j += 1
                    if j < n and text[j] not in (",", ";", "	", "\r", "\n"):
                        raise CsvParseError(
                            f"Malformed CSV near line {line_num}: unexpected character '{text[j]}' after closing quote.",
                            line=line_num,
                        )
            else:
                if not at_field_start:
                    raise CsvParseError(
                        f"Malformed CSV on line {line_num}: unescaped quote inside an unquoted field.",
                        line=line_num,
                    )
                in_quotes = True
                quote_start_line = line_num
        elif not in_quotes and ch in (",", ";", "\t"):
            at_field_start = True
        elif not in_quotes and ch not in (" ",):
            at_field_start = False
        i += 1

    if in_quotes:
        raise CsvParseError(
            f"Malformed CSV: unclosed quoted field starting on line {quote_start_line}.",
            line=quote_start_line,
        )
    return text


def detect_delimiter(sample_line: str) -> str:
    best_delim = ","
    best_count = -1
    for candidate in (",", "\t", ";"):
        in_q = False
        cnt = 0
        for ch in sample_line:
            if ch == '"':
                in_q = not in_q
            elif ch == candidate and not in_q:
                cnt += 1
        if cnt > best_count:
            best_count = cnt
            best_delim = candidate
    return best_delim


def parse_csv_text(raw_text: str) -> Tuple[List[str], List[List[str]]]:
    if len(raw_text.encode("utf-8", errors="ignore")) > MAX_IMPORT_BYTES:
        raise CsvParseError(f"File exceeds the maximum supported limit of {MAX_IMPORT_BYTES // (1024 * 1024)} MB.")

    cleaned = _validate_quotes_and_encoding(raw_text)
    first_nl = cleaned.find("\n")
    first_line = cleaned[:first_nl] if first_nl != -1 else cleaned
    delimiter = detect_delimiter(first_line)

    reader = csv.reader(io.StringIO(cleaned, newline=""), delimiter=delimiter, quotechar='"', doublequote=True)
    raw_matrix = [row for row in reader if any(str(cell).strip() != "" for cell in row)]

    if not raw_matrix:
        raise CsvParseError("No data rows were found in the CSV file.")

    headers = [str(h).strip() for h in raw_matrix[0]]
    if not headers or all(h == "" for h in headers):
        raise CsvParseError("Row 1 must contain non-empty column headers.")

    # Disambiguate duplicate header names transparently while preserving originals
    seen_hdr_counts: Dict[str, int] = defaultdict(int)
    unique_headers: List[str] = []
    for idx, h in enumerate(headers):
        base = h or f"Column_{idx + 1}"
        seen_hdr_counts[base] += 1
        unique_headers.append(base if seen_hdr_counts[base] == 1 else f"{base} ({seen_hdr_counts[base]})")

    data_rows = raw_matrix[1:]
    if not data_rows:
        raise CsvParseError("Header row found, but the file contains 0 data rows to import.")
    if len(data_rows) > MAX_IMPORT_ROWS:
        raise CsvParseError(f"File has {len(data_rows)} rows, exceeding the maximum of {MAX_IMPORT_ROWS} rows per import.")

    normalized_rows: List[List[str]] = []
    header_len = len(unique_headers)
    for r in data_rows:
        padded = [str(c).strip() for c in r[:header_len]]
        while len(padded) < header_len:
            padded.append("")
        normalized_rows.append(padded)

    return unique_headers, normalized_rows


def generate_template_csv(category: str) -> str:
    if category == "all":
        headers = [
            "dept_code", "dept_name", "school", "head_of_department", "sub_departments",
            "room_code", "room_name", "room_capacity", "room_type", "building", "floor", "lab_category", "room_lab_engineer", "equipment", "is_available",
            "instructor_name", "instructor_email", "instructor_title", "staff_role", "instructor_sub_department", "max_weekly_hours", "max_daily_classes", "qualified_courses",
            "course_code", "course_title", "course_type", "credit_hours", "lecture_credits", "lab_credits", "lab_session_mode", "is_compulsory", "is_elective", "elective_pool_name", "assigned_instructor", "assigned_lab_engineer", "required_equipment", "course_sub_department",
            "cohort_code", "batch_code", "section", "cohort_name", "cohort_size", "year", "semester", "home_room",
            "session_type", "sessions_per_week", "duration_minutes", "expected_students", "required_room_type", "registration_number",
        ]
        rows = [
            [
                "CS", "Computer Science", "School of Computing", "Dr. Alan Turing", "Artificial Intelligence; Systems",
                "HALL-101", "Alan Turing Hall", "70", "lecture", "Block A", "1", "", "", "Projector; Whiteboard", "yes",
                "Dr. Sarah Chen", "sarah.chen@university.edu", "Associate Professor", "faculty", "Artificial Intelligence", "14", "3", "CS-101; CS-201",
                "CS-101", "Programming Fundamentals", "lecture_lab", "4", "3", "1", "continuous", "yes", "no", "", "sarah.chen@university.edu", "", "Projector; Workstations", "Systems",
                "2K25-CS-A", "2K25", "A", "2K25 CS Section A", "45", "1", "1", "HALL-101",
                "Theory", "3", "50", "45", "lecture", "",
            ],
            [
                "CS", "Computer Science", "School of Computing", "Dr. Alan Turing", "Artificial Intelligence; Systems",
                "LAB-201", "Computing Lab 1", "45", "lab", "Lab Complex", "2", "Computing", "bilal.tariq@university.edu", "45 Workstations; Projector", "yes",
                "Engr. Bilal Tariq", "bilal.tariq@university.edu", "Senior Lab Engineer", "lab_engineer", "Systems", "18", "4", "CS-101; CS-201",
                "CS-201", "Data Structures", "lecture_lab", "4", "3", "1", "continuous", "yes", "no", "", "sarah.chen@university.edu", "bilal.tariq@university.edu", "Workstations", "Systems",
                "2K24-CS-B", "2K24", "B", "2K24 CS Section B", "42", "2", "3", "",
                "Lab", "1", "180", "42", "lab", "",
            ],
        ]
    else:
        schema = CATEGORY_DEFINITIONS.get(category)
        if not schema:
            raise ValueError(f"Unsupported import category: {category}")
        headers = schema["templateHeaders"]
        rows = schema["templateRows"]

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Column Detection & Confidence Scoring
# ---------------------------------------------------------------------------

def _all_category_fields(category: str) -> List[Dict[str, Any]]:
    if category == "all":
        # Complete unified superset across all 8 institutional import categories
        return [
            # Departments
            {"key": "deptCode", "label": "Department Code", "group": "Departments", "required": False, "type": "string", "synonyms": ["dept_code", "department_code", "dept", "department", "program_code"]},
            {"key": "deptName", "label": "Department Name", "group": "Departments", "required": False, "type": "string", "synonyms": ["dept_name", "department_name"]},
            {"key": "school", "label": "School / Faculty", "group": "Departments", "required": False, "type": "string", "synonyms": ["school", "faculty", "faculty_name", "faculty_group", "division", "college"]},
            {"key": "headOfDepartment", "label": "Head of Department", "group": "Departments", "required": False, "type": "string", "synonyms": ["head_of_department", "hod", "chair", "chairperson", "head"]},
            {"key": "subDepartments", "label": "Sub-Departments / Tracks", "group": "Departments", "required": False, "type": "list", "synonyms": ["sub_departments", "subdepartments", "tracks", "wings"]},

            # Rooms & Labs
            {"key": "roomCode", "label": "Room / Lab Code", "group": "Rooms & Labs", "required": False, "type": "string", "synonyms": ["room_code", "room", "classroom", "classroom_code", "hall", "room_no", "room_number", "lab_code", "laboratory_code", "facility_code"]},
            {"key": "roomName", "label": "Room / Lab Name", "group": "Rooms & Labs", "required": False, "type": "string", "synonyms": ["room_name", "lab_name", "hall_name", "classroom_name", "laboratory_name", "facility_name"]},
            {"key": "roomCapacity", "label": "Room / Lab Capacity", "group": "Rooms & Labs", "required": False, "type": "int", "synonyms": ["room_capacity", "capacity", "seats", "workstations", "lab_capacity", "max_students"]},
            {"key": "roomType", "label": "Room Type (lecture/seminar/auditorium/lab)", "group": "Rooms & Labs", "required": False, "type": "string", "synonyms": ["room_type", "classroom_type", "facility_type", "lab_type"]},
            {"key": "building", "label": "Building Name", "group": "Rooms & Labs", "required": False, "type": "string", "synonyms": ["building", "building_name", "block", "location"]},
            {"key": "floor", "label": "Floor Number", "group": "Rooms & Labs", "required": False, "type": "int", "synonyms": ["floor", "floor_no", "level"]},
            {"key": "labCategory", "label": "Lab Category", "group": "Rooms & Labs", "required": False, "type": "string", "synonyms": ["lab_category", "discipline"]},
            {"key": "roomLabEngineer", "label": "Room / Lab Engineer (email or name)", "group": "Rooms & Labs", "required": False, "type": "fk:instructor", "synonyms": ["room_lab_engineer", "lab_supervisor", "supervisor"]},
            {"key": "equipment", "label": "Room / Lab Equipment", "group": "Rooms & Labs", "required": False, "type": "list", "synonyms": ["equipment", "features", "amenities", "facilities", "resources", "hardware"]},
            {"key": "roomIsAvailable", "label": "Room Is Available (yes/no)", "group": "Rooms & Labs", "required": False, "type": "bool", "synonyms": ["is_available", "room_is_available", "available", "active"]},

            # Instructors & Lab Engineers
            {"key": "instructorName", "label": "Instructor Full Name", "group": "Instructors", "required": False, "type": "string", "synonyms": ["instructor_name", "instructor", "faculty_name", "teacher_name", "teacher", "professor", "lecturer", "faculty"]},
            {"key": "instructorEmail", "label": "Instructor Institutional Email", "group": "Instructors", "required": False, "type": "email", "synonyms": ["instructor_email", "email", "faculty_email", "teacher_email", "email_address", "mail"]},
            {"key": "instructorTitle", "label": "Instructor Designation / Title", "group": "Instructors", "required": False, "type": "string", "synonyms": ["instructor_title", "designation", "rank", "position", "academic_rank"]},
            {"key": "staffRole", "label": "Staff Role (faculty/lab_engineer)", "group": "Instructors", "required": False, "type": "enum:faculty,lab_engineer", "synonyms": ["staff_role", "role_type", "instructor_role"]},
            {"key": "instructorSubDepartment", "label": "Instructor Sub-Department / Wing", "group": "Instructors", "required": False, "type": "string", "synonyms": ["instructor_sub_department", "instructor_subdepartment", "wing"]},
            {"key": "maxWeeklyHours", "label": "Max Weekly Hours", "group": "Instructors", "required": False, "type": "int", "synonyms": ["max_weekly_hours", "weekly_hours", "max_hours", "workload_cap", "weekly_cap"]},
            {"key": "maxDailyClasses", "label": "Max Daily Classes", "group": "Instructors", "required": False, "type": "int", "synonyms": ["max_daily_classes", "max_lectures_per_day", "daily_cap", "max_daily"]},
            {"key": "qualifiedCourses", "label": "Qualified Course Codes", "group": "Instructors", "required": False, "type": "list", "synonyms": ["qualified_courses", "eligible_courses", "subjects", "can_teach", "specializations"]},

            # Courses
            {"key": "courseCode", "label": "Course Code", "group": "Courses", "required": False, "type": "string", "synonyms": ["course_code", "course", "subject_code", "course_id", "course_no", "subject_id"]},
            {"key": "courseTitle", "label": "Course Title", "group": "Courses", "required": False, "type": "string", "synonyms": ["course_title", "course_name", "subject", "subject_name"]},
            {"key": "courseType", "label": "Course Type (lecture/lab/lecture_lab)", "group": "Courses", "required": False, "type": "enum:lecture,lab,lecture_lab", "synonyms": ["course_type", "course_mode"]},
            {"key": "creditHours", "label": "Total Credit Hours", "group": "Courses", "required": False, "type": "int", "synonyms": ["credit_hours", "credits", "credit", "cr_hrs", "units"]},
            {"key": "lectureCredits", "label": "Lecture Credits", "group": "Courses", "required": False, "type": "int", "synonyms": ["lecture_credits", "theory_credits", "lec_credits", "lec_cr", "lecture_credit_hours"]},
            {"key": "labCredits", "label": "Lab Credits", "group": "Courses", "required": False, "type": "int", "synonyms": ["lab_credits", "practical_credits", "lab_cr", "lab_credit_hours"]},
            {"key": "labSessionMode", "label": "Lab Session Mode (continuous/split_allowed)", "group": "Courses", "required": False, "type": "enum:continuous,split_allowed", "synonyms": ["lab_session_mode", "lab_mode"]},
            {"key": "isCompulsory", "label": "Is Compulsory (yes/no)", "group": "Courses", "required": False, "type": "bool", "synonyms": ["is_compulsory", "compulsory", "mandatory", "core"]},
            {"key": "isElective", "label": "Is Elective (yes/no)", "group": "Courses", "required": False, "type": "bool", "synonyms": ["is_elective", "elective", "optional"]},
            {"key": "electivePoolName", "label": "Elective Pool Name", "group": "Courses", "required": False, "type": "string", "synonyms": ["elective_pool", "elective_pool_name", "pool_name"]},
            {"key": "assignedInstructor", "label": "Assigned Course Instructor (email or name)", "group": "Courses", "required": False, "type": "fk:instructor", "synonyms": ["assigned_instructor", "course_instructor"]},
            {"key": "assignedLabEngineer", "label": "Assigned Lab Engineer (email or name)", "group": "Courses", "required": False, "type": "fk:instructor", "synonyms": ["assigned_lab_engineer", "lab_engineer", "lab_engineer_email", "lab_engineer_name", "engineer"]},
            {"key": "requiredEquipment", "label": "Course Required Equipment", "group": "Courses", "required": False, "type": "list", "synonyms": ["required_equipment", "lab_equipment"]},
            {"key": "courseSubDepartment", "label": "Course Sub-Department / Track", "group": "Courses", "required": False, "type": "string", "synonyms": ["course_sub_department", "sub_department", "subdepartment", "track"]},
            {"key": "courseSemester", "label": "Course Semester (1–16)", "group": "Courses", "required": False, "type": "int", "synonyms": ["course_semester", "semester_number", "target_semester"]},

            # Batches & Sections
            {"key": "cohortCode", "label": "Cohort / Section Full Code (e.g. 2K24-CS-A)", "group": "Batches & Sections", "required": False, "type": "string", "synonyms": ["cohort_code", "class_code", "group_code", "cohort", "student_group"]},
            {"key": "batchCode", "label": "Intake / Batch Code (e.g. 2K24)", "group": "Batches & Sections", "required": False, "type": "string", "synonyms": ["batch_code", "intake", "batch", "batch_year", "cohort_year"]},
            {"key": "section", "label": "Section of Batch (e.g. A)", "group": "Batches & Sections", "required": False, "type": "string", "synonyms": ["section", "section_letter", "section_code", "sections", "sections_list", "sec"]},
            {"key": "cohortName", "label": "Batch / Section Name", "group": "Batches & Sections", "required": False, "type": "string", "synonyms": ["cohort_name", "batch_name", "section_name", "class_name"]},
            {"key": "cohortSize", "label": "Batch / Section Student Count", "group": "Batches & Sections", "required": False, "type": "int", "synonyms": ["cohort_size", "student_count", "size", "students", "headcount"]},
            {"key": "year", "label": "Academic Year (1–8)", "group": "Batches & Sections", "required": False, "type": "int", "synonyms": ["year", "study_year", "academic_year"]},
            {"key": "semester", "label": "Semester (1–16)", "group": "Batches & Sections", "required": False, "type": "int", "synonyms": ["semester", "sem", "term_number"]},
            {"key": "homeRoom", "label": "Home Room Code", "group": "Batches & Sections", "required": False, "type": "fk:room_or_lab", "synonyms": ["home_room", "default_room", "assigned_room"]},

            # Course Assignments & Enrollments
            {"key": "sessionType", "label": "Session Type (Theory/Lab/Tutorial)", "group": "Assignments & Enrollments", "required": False, "type": "enum:Theory,Lab,Tutorial", "synonyms": ["session_type", "component_type"]},
            {"key": "sessionsPerWeek", "label": "Sessions Per Week (1–6)", "group": "Assignments & Enrollments", "required": False, "type": "int", "synonyms": ["sessions_per_week", "weekly_sessions", "frequency"]},
            {"key": "durationMinutes", "label": "Session Duration Minutes (30–300)", "group": "Assignments & Enrollments", "required": False, "type": "int", "synonyms": ["duration_minutes", "duration", "minutes"]},
            {"key": "expectedStudents", "label": "Expected Students", "group": "Assignments & Enrollments", "required": False, "type": "int", "synonyms": ["expected_students", "enrollment"]},
            {"key": "requiredRoomType", "label": "Required Room Type (lecture/lab/seminar)", "group": "Assignments & Enrollments", "required": False, "type": "enum:lecture,lab,seminar", "synonyms": ["required_room_type"]},
            {"key": "studentRegistrationNumber", "label": "Student Registration No (optional)", "group": "Assignments & Enrollments", "required": False, "type": "fk:student", "synonyms": ["registration_number", "student_registration_number", "roll_no", "roll_number", "student_id", "reg_no"]},
        ]

    if category not in CATEGORY_DEFINITIONS:
        raise ValueError(f"Unsupported import category: {category}")
    return CATEGORY_DEFINITIONS[category]["fields"]


def detect_column_mappings(
    headers: List[str],
    category: str,
    manual_mappings: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    fields = _all_category_fields(category)
    field_by_key = {f["key"]: f for f in fields}

    mapping: Dict[str, str] = {}
    details: List[Dict[str, Any]] = []
    used_targets: Set[str] = set()

    # Pass 1: honor manual overrides cleanly (if valid target key)
    if manual_mappings:
        for hdr in headers:
            if hdr in manual_mappings:
                chosen = str(manual_mappings[hdr] or "").strip()
                if chosen == "":
                    mapping[hdr] = ""
                elif chosen in field_by_key:
                    mapping[hdr] = chosen
                    used_targets.add(chosen)

    # Pass 2: auto-detect unmapped headers
    for hdr in headers:
        if hdr in mapping:
            target = mapping[hdr]
            details.append({
                "header": hdr,
                "targetField": target,
                "confidence": "manual" if target else "unmapped",
                "reason": "Manually mapped" if target else "Ignored by user",
            })
            continue

        norm_h = _normalize_header(hdr)
        matched_target = ""
        confidence = "unmapped"
        reason = "No matching schema field found"

        # 2a. Exact match on key or normalized synonym
        for f in fields:
            if f["key"] in used_targets:
                continue
            if norm_h == _normalize_header(f["key"]) or norm_h == _normalize_header(f["label"]):
                matched_target = f["key"]
                confidence = "exact"
                reason = f"Exact match to '{f['label']}'"
                break

        # 2b. Explicit synonym match
        if not matched_target:
            for f in fields:
                if f["key"] in used_targets:
                    continue
                if any(norm_h == _normalize_header(syn) for syn in f.get("synonyms", [])):
                    matched_target = f["key"]
                    confidence = "synonym"
                    reason = f"Matched known header synonym for '{f['label']}'"
                    break

        # 2c. Partial/token similarity -> mark as 'uncertain' so UI flags for confirmation instead of silently trusting
        if not matched_target and len(norm_h) >= 3:
            tokens_h = set(norm_h.split("_"))
            best_score = 0.0
            best_field: Optional[Dict[str, Any]] = None
            for f in fields:
                if f["key"] in used_targets:
                    continue
                candidates = [f["key"], f["label"], *f.get("synonyms", [])]
                for cand in candidates:
                    nc = _normalize_header(cand)
                    if not nc:
                        continue
                    tokens_c = set(nc.split("_"))
                    overlap = len(tokens_h & tokens_c)
                    if overlap > 0:
                        score = overlap / max(len(tokens_h), len(tokens_c))
                        if score > best_score:
                            best_score = score
                            best_field = f
            if best_field and best_score >= 0.5:
                matched_target = best_field["key"]
                confidence = "uncertain"
                reason = f"Partial match to '{best_field['label']}' — please verify"

        mapping[hdr] = matched_target
        if matched_target:
            used_targets.add(matched_target)
        details.append({
            "header": hdr,
            "targetField": matched_target,
            "confidence": confidence,
            "reason": reason,
        })

    required_keys = [f["key"] for f in fields if f.get("required")]
    mapped_targets = {v for v in mapping.values() if v}
    missing_required = [
        {"key": f["key"], "label": f["label"]}
        for f in fields
        if f.get("required") and f["key"] not in mapped_targets
    ]

    # Detect duplicate target assignments (bad manual mapping!)
    target_to_headers: Dict[str, List[str]] = defaultdict(list)
    for hdr, tgt in mapping.items():
        if tgt:
            target_to_headers[tgt].append(hdr)
    conflicting_mappings = [
        {"targetField": tgt, "headers": hdrs}
        for tgt, hdrs in target_to_headers.items()
        if len(hdrs) > 1
    ]

    return {
        "mapping": mapping,
        "details": details,
        "missingRequiredFields": missing_required,
        "conflictingMappings": conflicting_mappings,
        "requiredKeys": required_keys,
    }


# ---------------------------------------------------------------------------
# Type & Value Parsers
# ---------------------------------------------------------------------------

def parse_strict_bool(raw: str, default: Optional[bool] = None) -> Optional[bool]:
    s = raw.strip().lower()
    if s == "":
        return default
    if s in ("true", "yes", "1", "y", "t"):
        return True
    if s in ("false", "no", "0", "n", "f"):
        return False
    raise ValueError(f"Invalid boolean value '{raw}'. Use yes/no, true/false, or 1/0.")


def parse_strict_int(raw: str, field_label: str, min_val: Optional[int] = None, max_val: Optional[int] = None) -> int:
    s = raw.strip()
    if not re.fullmatch(r"[+-]?\d+", s):
        raise ValueError(f"{field_label} must be a whole integer (received '{raw}').")
    val = int(s)
    if min_val is not None and val < min_val:
        raise ValueError(f"{field_label} must be >= {min_val} (received {val}).")
    if max_val is not None and val > max_val:
        raise ValueError(f"{field_label} must be <= {max_val} (received {val}).")
    return val


def split_list_value(raw: str) -> List[str]:
    if not raw or not raw.strip():
        return []
    return [item.strip() for item in re.split(r"[;|,]", raw) if item.strip()]


# ---------------------------------------------------------------------------
# Database Snapshot & Context Loader
# ---------------------------------------------------------------------------

def _safe_select(client: Any, table: str, filters: Dict[str, str], select: str = "*") -> List[Dict[str, Any]]:
    try:
        return client.select(table, filters=filters, select=select)
    except SupabaseQueryError:
        return []


def load_institution_context(client: Any, institution_id: str) -> Dict[str, Any]:
    depts = _safe_select(client, "departments", {"institution_id": f"eq.{institution_id}"})
    rooms = _safe_select(client, "classrooms", {"institution_id": f"eq.{institution_id}"})
    labs = _safe_select(client, "laboratories", {"institution_id": f"eq.{institution_id}"})
    instructors = _safe_select(client, "instructors", {"institution_id": f"eq.{institution_id}"})
    courses = _safe_select(client, "courses", {"institution_id": f"eq.{institution_id}"})
    batches = _safe_select(client, "batches", {"institution_id": f"eq.{institution_id}"})
    students = _safe_select(client, "students", {"institution_id": f"eq.{institution_id}"})
    users = _safe_select(client, "users", {"institution_id": f"eq.{institution_id}"}, select="id,name,email,registration_number,batch_id,section,role")
    enrollments = _safe_select(client, "course_enrollments", {"institution_id": f"eq.{institution_id}"})
    sessions = _safe_select(client, "course_sessions", {"institution_id": f"eq.{institution_id}"})
    equip = _safe_select(client, "room_equipment_capacities", {"institution_id": f"eq.{institution_id}"})

    equip_by_room: Dict[str, List[str]] = defaultdict(list)
    for eq in equip:
        if eq.get("room_id") and eq.get("equipment_name"):
            equip_by_room[eq["room_id"]].append(eq["equipment_name"])

    dept_by_code = {str(d["code"]).strip().upper(): d for d in depts if d.get("code")}
    dept_by_name = {str(d["name"]).strip().lower(): d for d in depts if d.get("name")}
    dept_by_id = {d["id"]: d for d in depts if d.get("id")}

    room_by_code = {str(r["code"]).strip().upper(): r for r in rooms if r.get("code")}
    lab_by_code = {str(l["code"]).strip().upper(): l for l in labs if l.get("code")}

    inst_by_email = {str(i["email"]).strip().lower(): i for i in instructors if i.get("email")}
    inst_by_name = {str(i["name"]).strip().lower(): i for i in instructors if i.get("name")}
    inst_by_id = {i["id"]: i for i in instructors if i.get("id")}

    course_by_code = {str(c["code"]).strip().upper(): c for c in courses if c.get("code")}
    course_by_id = {c["id"]: c for c in courses if c.get("id")}

    batch_by_code = {str(b["code"]).strip().upper(): b for b in batches if b.get("code")}
    batch_by_id = {b["id"]: b for b in batches if b.get("id")}

    student_by_reg = {str(s["registration_number"]).strip().upper(): s for s in students if s.get("registration_number")}
    user_student_by_reg = {
        str(u["registration_number"]).strip().upper(): u
        for u in users
        if u.get("registration_number") and u.get("role") in ("student", "br")
    }

    enrollment_by_key = {
        (
            e["course_id"],
            e["batch_id"],
            str(e.get("section") or "A").strip().upper(),
            str(e.get("student_id") or ""),
        ): e
        for e in enrollments
    }

    session_by_key = {
        (
            s["course_id"],
            s["batch_id"],
            str(s.get("section_code") or "A").strip().upper(),
            str(s.get("session_type") or "Theory").strip().lower(),
        ): s
        for s in sessions
    }

    return {
        "departments": depts,
        "dept_by_code": dept_by_code,
        "dept_by_name": dept_by_name,
        "dept_by_id": dept_by_id,
        "rooms": rooms,
        "room_by_code": room_by_code,
        "labs": labs,
        "lab_by_code": lab_by_code,
        "equip_by_room": equip_by_room,
        "instructors": instructors,
        "inst_by_email": inst_by_email,
        "inst_by_name": inst_by_name,
        "inst_by_id": inst_by_id,
        "courses": courses,
        "course_by_code": course_by_code,
        "course_by_id": course_by_id,
        "batches": batches,
        "batch_by_code": batch_by_code,
        "batch_by_id": batch_by_id,
        "students": students,
        "student_by_reg": student_by_reg,
        "user_student_by_reg": user_student_by_reg,
        "enrollments": enrollments,
        "enrollment_by_key": enrollment_by_key,
        "sessions": sessions,
        "session_by_key": session_by_key,
    }


def _compute_diffs(existing: Dict[str, Any], proposed: Dict[str, Any], compare_fields: List[Tuple[str, str]]) -> List[Dict[str, Any]]:
    diffs: List[Dict[str, Any]] = []
    for db_key, label in compare_fields:
        if db_key not in proposed:
            continue
        old_val = existing.get(db_key)
        new_val = proposed.get(db_key)
        if old_val != new_val:
            diffs.append({
                "field": db_key,
                "label": label,
                "before": old_val,
                "after": new_val,
            })
    return diffs


# ---------------------------------------------------------------------------
# Row-by-Row Validation & Staging Plan Builder
# ---------------------------------------------------------------------------

def validate_and_stage_import(
    client: Any,
    institution_id: str,
    category: str,
    duplicate_mode: str = "skip",
    csv_text: Optional[str] = None,
    headers: Optional[List[str]] = None,
    rows: Optional[List[List[str]]] = None,
    column_mappings: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    if category not in VALID_CATEGORIES:
        raise ValueError(f"Unsupported import category '{category}'.")
    if duplicate_mode not in VALID_DUPLICATE_MODES:
        raise ValueError(f"Invalid duplicate mode '{duplicate_mode}'. Expected one of: skip, update, stop.")

    if csv_text is not None:
        parsed_headers, parsed_rows = parse_csv_text(csv_text)
    elif headers is not None and rows is not None:
        if not headers or not rows:
            raise CsvParseError("Uploaded table must contain headers and at least one data row.")
        if len(rows) > MAX_IMPORT_ROWS:
            raise CsvParseError(f"File has {len(rows)} rows, exceeding the maximum of {MAX_IMPORT_ROWS}.")
        parsed_headers = [str(h).strip() or f"Column_{i+1}" for i, h in enumerate(headers)]
        parsed_rows = [[str(cell if cell is not None else "").strip() for cell in r[: len(parsed_headers)]] + [""] * max(0, len(parsed_headers) - len(r)) for r in rows]
        if not any(any(cell != "" for cell in r) for r in parsed_rows):
            raise CsvParseError("No non-empty data rows found.")
    else:
        raise CsvParseError("Provide either csvText or headers/rows to import.")

    mapping_info = detect_column_mappings(parsed_headers, category, column_mappings)
    active_mapping: Dict[str, str] = mapping_info["mapping"]

    if mapping_info["conflictingMappings"]:
        conflicts_txt = "; ".join(
            f"{c['targetField']} <- {', '.join(c['headers'])}" for c in mapping_info["conflictingMappings"]
        )
        return {
            "category": category,
            "duplicateMode": duplicate_mode,
            "headers": parsed_headers,
            "mappingInfo": mapping_info,
            "canProceed": False,
            "blockingReason": f"Duplicate column mapping conflict: {conflicts_txt}. Assign each CSV column to at most one target field.",
            "summary": {
                "totalRows": len(parsed_rows),
                "validRows": 0,
                "warningRows": 0,
                "errorRows": len(parsed_rows),
                "duplicateRows": 0,
                "createCount": 0,
                "updateCount": 0,
                "skipCount": 0,
                "missingRequiredCount": len(mapping_info["missingRequiredFields"]),
                "invalidTypeCount": 0,
                "invalidFkCount": 0,
            },
            "rows": [],
            "fieldDiffs": [],
            "plannedOperations": [],
        }

    if mapping_info["missingRequiredFields"]:
        missing_labels = ", ".join(m["label"] for m in mapping_info["missingRequiredFields"])
        return {
            "category": category,
            "duplicateMode": duplicate_mode,
            "headers": parsed_headers,
            "mappingInfo": mapping_info,
            "canProceed": False,
            "blockingReason": f"Required column mapping missing: {missing_labels}.",
            "summary": {
                "totalRows": len(parsed_rows),
                "validRows": 0,
                "warningRows": 0,
                "errorRows": len(parsed_rows),
                "duplicateRows": 0,
                "createCount": 0,
                "updateCount": 0,
                "skipCount": 0,
                "missingRequiredCount": len(mapping_info["missingRequiredFields"]),
                "invalidTypeCount": 0,
                "invalidFkCount": 0,
            },
            "rows": [],
            "fieldDiffs": [],
            "plannedOperations": [],
        }

    ctx = load_institution_context(client, institution_id)
    header_index = {h: idx for idx, h in enumerate(parsed_headers)}

    # Track keys created earlier within this SAME CSV upload (so sequential FKs & in-file duplicate checks work accurately)
    in_file_seen_keys: Dict[str, int] = {}
    staged_depts_by_code: Dict[str, Dict[str, Any]] = dict(ctx["dept_by_code"])
    staged_rooms_by_code: Dict[str, Dict[str, Any]] = {**ctx["room_by_code"], **ctx["lab_by_code"]}
    staged_inst_by_email: Dict[str, Dict[str, Any]] = dict(ctx["inst_by_email"])
    staged_inst_by_name: Dict[str, Dict[str, Any]] = dict(ctx["inst_by_name"])
    staged_courses_by_code: Dict[str, Dict[str, Any]] = dict(ctx["course_by_code"])
    staged_batches_by_code: Dict[str, Dict[str, Any]] = dict(ctx["batch_by_code"])
    staged_enrollment_keys: Set[Tuple[str, str, str, str]] = set(ctx["enrollment_by_key"].keys())
    staged_session_keys: Set[Tuple[str, str, str, str]] = set(ctx["session_by_key"].keys())
    in_file_all_entities: Set[str] = set()
    staged_new_course_codes: Set[str] = set()
    staged_course_inferred_sems: Dict[str, Set[int]] = defaultdict(set)

    # Reverse map from targetKey -> source CSV column name for accurate error attribution
    target_to_src_header = {tgt: hdr for hdr, tgt in active_mapping.items() if tgt}

    def src_col(target_key: str) -> str:
        return target_to_src_header.get(target_key, target_key)

    def resolve_dept(key: str) -> Optional[Dict[str, Any]]:
        k = key.strip()
        if not k:
            return None
        return staged_depts_by_code.get(k.upper()) or ctx["dept_by_name"].get(k.lower())

    def resolve_instructor(key: str) -> Optional[Dict[str, Any]]:
        k = key.strip()
        if not k:
            return None
        return staged_inst_by_email.get(k.lower()) or staged_inst_by_name.get(k.lower())

    row_results: List[Dict[str, Any]] = []
    planned_ops: List[Dict[str, Any]] = []
    field_diffs: List[Dict[str, Any]] = []

    missing_req_cnt = 0
    invalid_type_cnt = 0
    invalid_fk_cnt = 0
    duplicate_cnt = 0
    warning_cnt = 0
    error_cnt = 0
    create_cnt = 0
    update_cnt = 0
    skip_cnt = 0

    for idx_zero, raw_cells in enumerate(parsed_rows):
        row_num = idx_zero + 2  # 1-based line number (header is line 1)
        original_row = {parsed_headers[i]: (raw_cells[i] if i < len(raw_cells) else "") for i in range(len(parsed_headers))}
        mapped_vals: Dict[str, str] = {}
        for hdr, tgt in active_mapping.items():
            if tgt:
                cidx = header_index.get(hdr, -1)
                mapped_vals[tgt] = raw_cells[cidx].strip() if 0 <= cidx < len(raw_cells) else ""

        errors: List[Dict[str, str]] = []
        warnings: List[Dict[str, str]] = []

        def add_err(target_key: str, kind: str, message: str, suggestion: str) -> None:
            nonlocal missing_req_cnt, invalid_type_cnt, invalid_fk_cnt
            if kind == "missing_required":
                missing_req_cnt += 1
            elif kind == "invalid_type":
                invalid_type_cnt += 1
            elif kind == "invalid_fk":
                invalid_fk_cnt += 1
            errors.append({
                "column": src_col(target_key),
                "targetField": target_key,
                "kind": kind,
                "message": message,
                "suggestion": suggestion,
            })

        def add_warn(target_key: str, message: str) -> None:
            warnings.append({
                "column": src_col(target_key),
                "targetField": target_key,
                "message": message,
            })

        row_status = "ready"
        action = "create"
        stable_id = ""
        row_op: Optional[Dict[str, Any]] = None

        # ---------------- Category Validation Handlers ----------------
        if category == "departments":
            code = mapped_vals.get("code", "").upper()
            name = mapped_vals.get("name", "")
            school = mapped_vals.get("school", "") or "Engineering & Computing"
            hod = mapped_vals.get("headOfDepartment", "")
            sub_depts = split_list_value(mapped_vals.get("subDepartments", ""))

            if not code:
                add_err("code", "missing_required", "Department code is required.", "Provide a short code such as CS or EE.")
            elif len(code) > 20:
                add_err("code", "invalid_type", f"Department code '{code}' exceeds 20 characters.", "Use a concise code up to 20 characters.")
            if not name:
                add_err("name", "missing_required", "Department name is required.", "Provide the full department title.")

            if code:
                dup_key = f"dept:{code}"
                if dup_key in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_key]
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Duplicate department code '{code}' already appeared on row {first_line}.", "Remove duplicate rows or switch duplicate handling to Skip/Update.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Duplicate in CSV (first seen at line {first_line}); row will be skipped.")
                else:
                    in_file_seen_keys[dup_key] = row_num

                existing = ctx["dept_by_code"].get(code)
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Department '{code}' already exists in this university.", "Use Skip or Update duplicate handling to proceed.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Matches existing department '{code}'; will be skipped.")
                    else:
                        action = "update"
                        payload = {
                            "name": name or existing["name"],
                            "faculty_name": school,
                            "head_of_department": hod or existing.get("head_of_department") or "",
                        }
                        diffs = _compute_diffs(existing, payload, [("name", "Department Name"), ("faculty_name", "School / Faculty"), ("head_of_department", "Head of Department")])
                        field_diffs.append({"row": row_num, "identifier": code, "entity": "Department", "diffs": diffs})
                        row_op = {"entity": "departments", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "subDepartments": sub_depts, "code": code}
                elif not errors and action == "create":
                    new_id = f"dept-{uuid.uuid4().hex[:8]}"
                    payload = {
                        "id": new_id,
                        "institution_id": institution_id,
                        "code": code,
                        "name": name,
                        "faculty_name": school,
                        "head_of_department": hod,
                        "created_at": now_iso(),
                    }
                    staged_depts_by_code[code] = payload
                    row_op = {"entity": "departments", "action": "create", "id": new_id, "payload": payload, "subDepartments": sub_depts, "code": code}
            stable_id = code

        elif category == "rooms":
            code = mapped_vals.get("code", "").upper()
            name = mapped_vals.get("name", "") or code
            cap_raw = mapped_vals.get("capacity", "")
            type_raw = (mapped_vals.get("type", "") or "lecture").lower()
            building = mapped_vals.get("building", "") or "Main Academic Block"
            floor_raw = mapped_vals.get("floor", "")
            equipment = split_list_value(mapped_vals.get("equipment", ""))
            avail_raw = mapped_vals.get("isAvailable", "")

            if not code:
                add_err("code", "missing_required", "Room code is required.", "Provide a unique code such as HALL-101.")
            capacity = 60
            if not cap_raw:
                add_err("capacity", "missing_required", "Seating capacity is required.", "Enter a positive integer capacity (e.g. 60).")
            else:
                try:
                    capacity = parse_strict_int(cap_raw, "Room capacity", min_val=1, max_val=2000)
                    if capacity > 500:
                        add_warn("capacity", f"High seating capacity ({capacity}). Verify this is intentional.")
                except ValueError as exc:
                    add_err("capacity", "invalid_type", str(exc), "Provide an integer between 1 and 2000.")

            floor = 1
            if floor_raw:
                try:
                    floor = parse_strict_int(floor_raw, "Floor", min_val=-5, max_val=100)
                except ValueError as exc:
                    add_err("floor", "invalid_type", str(exc), "Provide a valid floor integer.")

            room_type = "lecture"
            if type_raw:
                if type_raw in ("lecture", "classroom", "hall", "theory"):
                    room_type = "lecture"
                elif type_raw in ("seminar", "tutorial"):
                    room_type = "seminar"
                elif type_raw in ("auditorium", "amphitheater", "amphitheatre"):
                    room_type = "auditorium"
                elif "lab" in type_raw:
                    add_err("type", "invalid_type", f"'{type_raw}' belongs in the Laboratories category rather than Classrooms.", "Use 'lecture', 'seminar', or 'auditorium', or switch category to Laboratories.")
                else:
                    add_err("type", "invalid_type", f"Unsupported room type '{type_raw}'.", "Allowed values: lecture, seminar, auditorium.")

            is_avail = True
            if avail_raw:
                try:
                    is_avail = bool(parse_strict_bool(avail_raw, default=True))
                except ValueError as exc:
                    add_err("isAvailable", "invalid_type", str(exc), "Use yes/no or true/false.")

            if code:
                dup_key = f"room:{code}"
                if dup_key in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_key]
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Duplicate room code '{code}' already appeared on row {first_line}.", "Deduplicate CSV rows or choose Skip/Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Duplicate in CSV (line {first_line}); row skipped.")
                else:
                    in_file_seen_keys[dup_key] = row_num

                existing = ctx["room_by_code"].get(code)
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Classroom '{code}' already exists in database.", "Select Skip or Update mode to handle existing classrooms.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Classroom '{code}' already exists; skipped.")
                    else:
                        action = "update"
                        payload = {"name": name, "building": building, "floor": floor, "capacity": capacity, "room_type": room_type, "is_available": is_avail}
                        diffs = _compute_diffs(existing, payload, [("name", "Room Name"), ("building", "Building"), ("floor", "Floor"), ("capacity", "Capacity"), ("room_type", "Room Type"), ("is_available", "Available")])
                        field_diffs.append({"row": row_num, "identifier": code, "entity": "Classroom", "diffs": diffs})
                        row_op = {"entity": "classrooms", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "equipment": equipment, "code": code}
                elif not errors and action == "create":
                    new_id = f"room-{uuid.uuid4().hex[:8]}"
                    payload = {"id": new_id, "institution_id": institution_id, "code": code, "name": name, "building": building, "floor": floor, "capacity": capacity, "room_type": room_type, "is_available": is_avail, "created_at": now_iso()}
                    staged_rooms_by_code[code] = payload
                    row_op = {"entity": "classrooms", "action": "create", "id": new_id, "payload": payload, "equipment": equipment, "code": code}
            stable_id = code

        elif category == "laboratories":
            code = mapped_vals.get("code", "").upper()
            name = mapped_vals.get("name", "") or code
            cap_raw = mapped_vals.get("capacity", "")
            building = mapped_vals.get("building", "") or "Engineering Lab Complex"
            lab_cat = mapped_vals.get("labCategory", "") or "Computing"
            dept_raw = mapped_vals.get("departmentCode", "")
            eng_raw = mapped_vals.get("assignedLabEngineer", "")
            equipment = split_list_value(mapped_vals.get("equipment", ""))
            avail_raw = mapped_vals.get("isAvailable", "")

            if not code:
                add_err("code", "missing_required", "Laboratory code is required.", "Provide a unique lab code (e.g. LAB-201).")
            if not mapped_vals.get("name", ""):
                add_err("name", "missing_required", "Laboratory name is required.", "Provide a descriptive laboratory name.")

            capacity = 40
            if not cap_raw:
                add_err("capacity", "missing_required", "Lab capacity is required.", "Enter seating/workstation count (1–500).")
            else:
                try:
                    capacity = parse_strict_int(cap_raw, "Lab capacity", min_val=1, max_val=500)
                except ValueError as exc:
                    add_err("capacity", "invalid_type", str(exc), "Provide a whole integer between 1 and 500.")

            is_avail = True
            if avail_raw:
                try:
                    is_avail = bool(parse_strict_bool(avail_raw, default=True))
                except ValueError as exc:
                    add_err("isAvailable", "invalid_type", str(exc), "Use yes/no or true/false.")

            dept_id: Optional[str] = None
            if dept_raw:
                dept = resolve_dept(dept_raw)
                if not dept:
                    add_err("departmentCode", "invalid_fk", f"Department '{dept_raw}' does not exist in this university.", "Import or create the department first, or check department code spelling.")
                else:
                    dept_id = dept["id"]

            eng_id: Optional[str] = None
            if eng_raw:
                eng = resolve_instructor(eng_raw)
                if not eng:
                    add_err("assignedLabEngineer", "invalid_fk", f"Lab engineer '{eng_raw}' was not found in faculty records.", "Import instructors first or enter an existing instructor email/name.")
                else:
                    eng_id = eng["id"]

            if code:
                dup_key = f"lab:{code}"
                if dup_key in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_key]
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Duplicate lab code '{code}' already appeared on row {first_line}.", "Remove duplicate rows or choose Skip/Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Duplicate in CSV (line {first_line}); row skipped.")
                else:
                    in_file_seen_keys[dup_key] = row_num

                existing = ctx["lab_by_code"].get(code)
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Laboratory '{code}' already exists.", "Select Skip or Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Laboratory '{code}' already exists; skipped.")
                    else:
                        action = "update"
                        payload = {"name": name, "building": building, "capacity": capacity, "lab_category": lab_cat, "department_id": dept_id, "assigned_lab_engineer_id": eng_id, "is_available": is_avail}
                        diffs = _compute_diffs(existing, payload, [("name", "Lab Name"), ("building", "Building"), ("capacity", "Capacity"), ("lab_category", "Category"), ("department_id", "Department ID"), ("is_available", "Available")])
                        field_diffs.append({"row": row_num, "identifier": code, "entity": "Laboratory", "diffs": diffs})
                        row_op = {"entity": "laboratories", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "equipment": equipment, "code": code}
                elif not errors and action == "create":
                    new_id = f"lab-{uuid.uuid4().hex[:8]}"
                    payload = {"id": new_id, "institution_id": institution_id, "department_id": dept_id, "code": code, "name": name, "building": building, "capacity": capacity, "lab_category": lab_cat, "assigned_lab_engineer_id": eng_id, "is_available": is_avail, "created_at": now_iso()}
                    staged_rooms_by_code[code] = payload
                    row_op = {"entity": "laboratories", "action": "create", "id": new_id, "payload": payload, "equipment": equipment, "code": code}
            stable_id = code

        elif category == "instructors":
            name = mapped_vals.get("name", "")
            email = mapped_vals.get("email", "").lower()
            dept_raw = mapped_vals.get("departmentCode", "")
            title = mapped_vals.get("title", "") or "Assistant Professor"
            role_raw = (mapped_vals.get("staffRole", "") or "faculty").lower()
            sub_dept = mapped_vals.get("subDepartment", "")
            max_wk_raw = mapped_vals.get("maxWeeklyHours", "")
            max_day_raw = mapped_vals.get("maxDailyClasses", "")
            qual_courses = split_list_value(mapped_vals.get("qualifiedCourses", ""))

            if not name:
                add_err("name", "missing_required", "Instructor full name is required.", "Provide the faculty member or lab engineer name.")
            if not email:
                add_err("email", "missing_required", "Institutional email is required for stable instructor identification.", "Provide a unique email address such as name@university.edu.")
            elif not EMAIL_RE.match(email):
                add_err("email", "invalid_type", f"'{email}' is not a valid email address.", "Use standard format username@domain.edu.")

            staff_role = "faculty"
            if role_raw in ("faculty", "professor", "lecturer", "instructor", "teacher"):
                staff_role = "faculty"
            elif role_raw in ("lab_engineer", "lab engineer", "engineer", "demonstrator", "ta"):
                staff_role = "lab_engineer"
            elif role_raw:
                add_err("staffRole", "invalid_type", f"Unsupported staff role '{role_raw}'.", "Allowed values: faculty or lab_engineer.")

            max_weekly = 18 if staff_role == "lab_engineer" else 15
            if max_wk_raw:
                try:
                    max_weekly = parse_strict_int(max_wk_raw, "Max weekly hours", min_val=1, max_val=45)
                except ValueError as exc:
                    add_err("maxWeeklyHours", "invalid_type", str(exc), "Enter an integer between 1 and 45.")

            max_daily = 4
            if max_day_raw:
                try:
                    max_daily = parse_strict_int(max_day_raw, "Max daily classes", min_val=1, max_val=10)
                except ValueError as exc:
                    add_err("maxDailyClasses", "invalid_type", str(exc), "Enter an integer between 1 and 10.")

            dept_id: Optional[str] = None
            if dept_raw:
                dept = resolve_dept(dept_raw)
                if not dept:
                    add_err("departmentCode", "invalid_fk", f"Department '{dept_raw}' does not exist in this institution.", "Create the department first or correct the department code.")
                else:
                    dept_id = dept["id"]

            for cc in qual_courses:
                if cc.upper() not in staged_courses_by_code:
                    add_err("qualifiedCourses", "invalid_fk", f"Qualified course '{cc}' does not exist in this university catalog.", "Import courses first or verify course code spelling.")

            if email:
                dup_key = f"inst:{email}"
                if dup_key in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_key]
                    if duplicate_mode == "stop":
                        add_err("email", "duplicate", f"Duplicate instructor email '{email}' already appeared on row {first_line}.", "Deduplicate email rows or select Skip/Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("email", f"Duplicate email in CSV (line {first_line}); row skipped.")
                else:
                    in_file_seen_keys[dup_key] = row_num

                existing = ctx["inst_by_email"].get(email)
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("email", "duplicate", f"Instructor with email '{email}' already exists.", "Select Skip or Update duplicate mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("email", f"Instructor '{email}' already exists; skipped.")
                    else:
                        action = "update"
                        payload = {
                            "name": name,
                            "department_id": dept_id,
                            "designation": title,
                            "max_weekly_hours": max_weekly,
                            "max_daily_classes": max_daily,
                            "specializations": qual_courses or existing.get("specializations") or [],
                        }
                        diffs = _compute_diffs(existing, payload, [("name", "Full Name"), ("designation", "Designation"), ("max_weekly_hours", "Max Weekly Hours"), ("max_daily_classes", "Max Daily Classes"), ("department_id", "Department ID")])
                        field_diffs.append({"row": row_num, "identifier": email, "entity": "Instructor", "diffs": diffs})
                        row_op = {"entity": "instructors", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "staffRole": staff_role, "subDepartment": sub_dept, "qualifiedCourses": qual_courses}
                elif not errors and action == "create":
                    new_id = f"inst-fac-{uuid.uuid4().hex[:8]}"
                    payload = {
                        "id": new_id,
                        "institution_id": institution_id,
                        "department_id": dept_id,
                        "name": name,
                        "email": email,
                        "designation": title,
                        "max_weekly_hours": max_weekly,
                        "max_daily_classes": max_daily,
                        "specializations": qual_courses,
                        "created_at": now_iso(),
                    }
                    staged_inst_by_email[email] = payload
                    staged_inst_by_name[name.lower()] = payload
                    row_op = {"entity": "instructors", "action": "create", "id": new_id, "payload": payload, "staffRole": staff_role, "subDepartment": sub_dept, "qualifiedCourses": qual_courses}
            stable_id = email or name

        elif category == "courses":
            code = mapped_vals.get("code", "").upper()
            title = mapped_vals.get("title", "")
            dept_raw = mapped_vals.get("departmentCode", "")
            ctype_raw = (mapped_vals.get("courseType", "") or "").lower()
            cr_raw = mapped_vals.get("creditHours", "")
            lec_raw = mapped_vals.get("lectureCredits", "")
            lab_raw = mapped_vals.get("labCredits", "")
            lab_mode_raw = (mapped_vals.get("labSessionMode", "") or "continuous").lower()
            comp_raw = mapped_vals.get("isCompulsory", "")
            elec_raw = mapped_vals.get("isElective", "")
            pool_name = mapped_vals.get("electivePoolName", "")
            inst_raw = mapped_vals.get("assignedInstructor", "")
            lab_eng_raw = mapped_vals.get("assignedLabEngineer", "")
            req_equip = split_list_value(mapped_vals.get("requiredEquipment", ""))
            sub_dept = mapped_vals.get("subDepartment", "")
            course_sem_raw = mapped_vals.get("semester", "")
            course_sem_val: Optional[int] = None
            if course_sem_raw:
                try:
                    course_sem_val = parse_strict_int(course_sem_raw, "Semester", min_val=1, max_val=16)
                except ValueError as exc:
                    add_err("semester", "invalid_type", str(exc), "Enter integer 1–16.")

            if not code:
                add_err("code", "missing_required", "Course code is required.", "Provide a unique course code such as CS-101.")
            if not title:
                add_err("title", "missing_required", "Course title is required.", "Provide a full course title.")
            dept_id = None
            if not dept_raw:
                add_err("departmentCode", "missing_required", "Department code is required for every course.", "Provide an existing department code such as CS.")
            else:
                dept = resolve_dept(dept_raw)
                if not dept:
                    add_err("departmentCode", "invalid_fk", f"Department '{dept_raw}' does not exist in this institution.", "Import/create the department first before importing courses.")
                else:
                    dept_id = dept["id"]

            if ctype_raw and ctype_raw not in ("lecture", "theory", "lab", "lecture_lab", "lecture+lab", "both"):
                add_err("courseType", "invalid_type", f"Invalid course type '{ctype_raw}'.", "Allowed values: lecture, lab, lecture_lab.")

            if lab_mode_raw not in ("continuous", "split_allowed"):
                add_err("labSessionMode", "invalid_type", f"Invalid lab session mode '{lab_mode_raw}'.", "Allowed values: continuous or split_allowed.")

            lec_cr: Optional[int] = None
            lab_cr: Optional[int] = None
            total_cr: Optional[int] = None
            if lec_raw:
                try:
                    lec_cr = parse_strict_int(lec_raw, "Lecture credits", min_val=0, max_val=6)
                except ValueError as exc:
                    add_err("lectureCredits", "invalid_type", str(exc), "Enter integer 0–6.")
            if lab_raw:
                try:
                    lab_cr = parse_strict_int(lab_raw, "Lab credits", min_val=0, max_val=4)
                except ValueError as exc:
                    add_err("labCredits", "invalid_type", str(exc), "Enter integer 0–4.")
            if cr_raw:
                try:
                    total_cr = parse_strict_int(cr_raw, "Credit hours", min_val=1, max_val=6)
                except ValueError as exc:
                    add_err("creditHours", "invalid_type", str(exc), "Enter integer 1–6.")

            if lec_cr is None and lab_cr is None:
                base_cr = total_cr if total_cr is not None else 3
                if ctype_raw == "lab":
                    lec_cr, lab_cr = 0, min(4, base_cr)
                elif ctype_raw in ("lecture_lab", "lecture+lab", "both"):
                    lec_cr, lab_cr = max(1, base_cr - 1), 1
                else:
                    lec_cr, lab_cr = base_cr, 0
            else:
                lec_cr = lec_cr or 0
                lab_cr = lab_cr or 0

            if lec_cr + lab_cr <= 0:
                add_err("creditHours", "invalid_type", "Course must have at least 1 lecture or lab credit hour.", "Set lecture_credits or lab_credits to >= 1.")
            effective_total_cr = min(6, max(1, total_cr or (lec_cr + lab_cr)))
            effective_type = "lecture_lab" if (lec_cr > 0 and lab_cr > 0) else ("lab" if lab_cr > 0 else "lecture")

            is_compulsory = True
            try:
                comp_parsed = parse_strict_bool(comp_raw, default=None) if comp_raw else None
                elec_parsed = parse_strict_bool(elec_raw, default=None) if elec_raw else None
                if elec_parsed is not None:
                    is_compulsory = not elec_parsed
                elif comp_parsed is not None:
                    is_compulsory = comp_parsed
            except ValueError as exc:
                add_err("isElective" if elec_raw else "isCompulsory", "invalid_type", str(exc), "Use yes/no or true/false.")

            assigned_inst_id = None
            if inst_raw:
                inst = resolve_instructor(inst_raw)
                if not inst:
                    add_err("assignedInstructor", "invalid_fk", f"Assigned instructor '{inst_raw}' not found.", "Import instructors first or enter valid email/name.")
                else:
                    assigned_inst_id = inst["id"]

            assigned_lab_eng_id = None
            if lab_eng_raw:
                eng = resolve_instructor(lab_eng_raw)
                if not eng:
                    add_err("assignedLabEngineer", "invalid_fk", f"Assigned lab engineer '{lab_eng_raw}' not found.", "Import instructors first or enter valid email/name.")
                else:
                    assigned_lab_eng_id = eng["id"]

            if code:
                dup_key = f"course:{code}"
                if dup_key in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_key]
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Duplicate course code '{code}' already appeared on row {first_line}.", "Remove duplicate rows or switch duplicate handling to Skip/Update.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Duplicate course in CSV (line {first_line}); row skipped.")
                else:
                    in_file_seen_keys[dup_key] = row_num

                existing = ctx["course_by_code"].get(code)
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Course '{code}' already exists in catalog.", "Select Skip or Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Course '{code}' already exists; skipped.")
                    else:
                        action = "update"
                        payload = {
                            "title": title,
                            "department_id": dept_id,
                            "credit_hours": effective_total_cr,
                            "lecture_hours_per_week": lec_cr,
                            "lab_hours_per_week": lab_cr * 3,
                            "course_type": effective_type,
                            "lecture_credit_hours": lec_cr,
                            "lab_credit_hours": lab_cr,
                            "assigned_instructor_id": assigned_inst_id,
                            "assigned_lab_engineer_id": assigned_lab_eng_id,
                            "lab_session_mode": lab_mode_raw,
                            "is_compulsory": is_compulsory,
                            "required_equipment": req_equip,
                            "sub_department": sub_dept or None,
                            "semester_number": course_sem_val if course_sem_val is not None else existing.get("semester_number"),
                        }
                        diffs = _compute_diffs(existing, payload, [("title", "Course Title"), ("department_id", "Department ID"), ("credit_hours", "Credit Hours"), ("lecture_credit_hours", "Lecture Credits"), ("lab_credit_hours", "Lab Credits"), ("semester_number", "Semester"), ("is_compulsory", "Compulsory")])
                        field_diffs.append({"row": row_num, "identifier": code, "entity": "Course", "diffs": diffs})
                        row_op = {"entity": "courses", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "electivePoolName": pool_name, "deptCode": dept_raw.upper()}
                elif not errors and action == "create":
                    new_id = f"crs-{uuid.uuid4().hex[:8]}"
                    payload = {
                        "id": new_id,
                        "institution_id": institution_id,
                        "department_id": dept_id,
                        "code": code,
                        "title": title,
                        "credit_hours": effective_total_cr,
                        "lecture_hours_per_week": lec_cr,
                        "lab_hours_per_week": lab_cr * 3,
                        "course_type": effective_type,
                        "lecture_credit_hours": lec_cr,
                        "lab_credit_hours": lab_cr,
                        "assigned_instructor_id": assigned_inst_id,
                        "assigned_lab_engineer_id": assigned_lab_eng_id,
                        "lab_session_mode": lab_mode_raw,
                        "is_compulsory": is_compulsory,
                        "required_equipment": req_equip,
                        "sub_department": sub_dept or None,
                        "semester_number": course_sem_val,
                        "created_at": now_iso(),
                    }
                    staged_courses_by_code[code] = payload
                    row_op = {"entity": "courses", "action": "create", "id": new_id, "payload": payload, "electivePoolName": pool_name, "deptCode": dept_raw.upper()}
            stable_id = code

        elif category == "cohorts":
            code = mapped_vals.get("code", "").upper()
            name = mapped_vals.get("name", "") or f"Cohort {code}"
            dept_raw = mapped_vals.get("departmentCode", "").upper()
            batch_code = mapped_vals.get("batchCode", "").upper()
            section = mapped_vals.get("section", "").upper() or (code.split("-")[-1] if "-" in code else "A")
            year_raw = mapped_vals.get("year", "")
            sem_raw = mapped_vals.get("semester", "")
            size_raw = mapped_vals.get("size", "")
            home_room_raw = mapped_vals.get("homeRoom", "").upper()

            if not code:
                add_err("code", "missing_required", "Batch/Section code is required.", "Provide a unique cohort code like 2K24-CS-A.")
            if not dept_raw:
                add_err("departmentCode", "missing_required", "Department code is required for every batch.", "Provide an existing department code such as CS.")
            elif not resolve_dept(dept_raw):
                add_err("departmentCode", "invalid_fk", f"Department '{dept_raw}' was not found.", "Import/create the department first.")

            size_val = 45
            if not size_raw:
                add_err("size", "missing_required", "Student count / class size is required.", "Enter a positive integer student count.")
            else:
                try:
                    size_val = parse_strict_int(size_raw, "Student count", min_val=1, max_val=1000)
                except ValueError as exc:
                    add_err("size", "invalid_type", str(exc), "Provide a whole number between 1 and 1000.")

            year_val = 1
            if year_raw:
                try:
                    year_val = parse_strict_int(year_raw, "Academic year", min_val=1, max_val=8)
                except ValueError as exc:
                    add_err("year", "invalid_type", str(exc), "Enter integer 1–8.")

            sem_val = 1
            if sem_raw:
                try:
                    sem_val = parse_strict_int(sem_raw, "Semester", min_val=1, max_val=16)
                except ValueError as exc:
                    add_err("semester", "invalid_type", str(exc), "Enter integer 1–16.")

            if home_room_raw and home_room_raw not in staged_rooms_by_code:
                add_err("homeRoom", "invalid_fk", f"Home room '{home_room_raw}' does not exist in rooms or laboratories.", "Import rooms/labs first or leave home_room blank.")

            if code:
                dup_key = f"batch:{code}"
                if dup_key in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_key]
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Duplicate batch code '{code}' already appeared on row {first_line}.", "Remove duplicate rows or choose Skip/Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Duplicate batch in CSV (line {first_line}); row skipped.")
                else:
                    in_file_seen_keys[dup_key] = row_num

                existing = ctx["batch_by_code"].get(code)
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("code", "duplicate", f"Batch '{code}' already exists.", "Select Skip or Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("code", f"Batch '{code}' already exists; skipped.")
                    else:
                        action = "update"
                        eff_batch_code = batch_code or (code.split("-")[0] if "-" in code else code)
                        payload = {
                            "name": name,
                            "batch_code": eff_batch_code,
                            "department_code": dept_raw,
                            "year": year_val,
                            "semester": sem_val,
                            "student_count": size_val,
                            "section": section,
                            "sections_list": section,
                            "home_room": home_room_raw or None,
                        }
                        diffs = _compute_diffs(existing, payload, [("name", "Batch Name"), ("batch_code", "Intake Batch"), ("department_code", "Department"), ("year", "Year"), ("semester", "Semester"), ("student_count", "Student Count"), ("section", "Section"), ("home_room", "Home Room")])
                        field_diffs.append({"row": row_num, "identifier": code, "entity": "Batch & Section", "diffs": diffs})
                        row_op = {"entity": "batches", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "batchCode": eff_batch_code, "section": section, "homeRoom": home_room_raw}
                elif not errors and action == "create":
                    new_id = f"batch-{uuid.uuid4().hex[:8]}"
                    eff_batch_code = batch_code or (code.split("-")[0] if "-" in code else code)
                    payload = {
                        "id": new_id,
                        "code": code,
                        "batch_code": eff_batch_code,
                        "name": name,
                        "department_code": dept_raw,
                        "year": year_val,
                        "semester": sem_val,
                        "student_count": size_val,
                        "section": section,
                        "sections_list": section,
                        "home_room": home_room_raw or None,
                        "institution_id": institution_id,
                        "created_at": now_iso(),
                    }
                    staged_batches_by_code[code] = payload
                    row_op = {"entity": "batches", "action": "create", "id": new_id, "payload": payload, "batchCode": eff_batch_code, "section": section, "homeRoom": home_room_raw}
            stable_id = code

        elif category == "enrollments":
            course_code = mapped_vals.get("courseCode", "").upper()
            batch_code = mapped_vals.get("batchCode", "").upper()
            section = (mapped_vals.get("section", "") or "A").upper()
            reg_no = mapped_vals.get("studentRegistrationNumber", "").upper()

            course_obj = staged_courses_by_code.get(course_code) if course_code else None
            batch_obj = staged_batches_by_code.get(batch_code) if batch_code else None

            if not course_code:
                add_err("courseCode", "missing_required", "Course code is required.", "Provide an existing course code.")
            elif not course_obj:
                add_err("courseCode", "invalid_fk", f"Course '{course_code}' does not exist in catalog.", "Import courses before importing enrollments.")

            if not batch_code:
                add_err("batchCode", "missing_required", "Batch/cohort code is required.", "Provide an existing batch code.")
            elif not batch_obj:
                add_err("batchCode", "invalid_fk", f"Batch '{batch_code}' does not exist.", "Import batches/sections before importing enrollments.")

            student_id: Optional[str] = None
            if reg_no:
                stu = ctx["student_by_reg"].get(reg_no)
                if stu:
                    student_id = stu["id"]
                else:
                    add_err("studentRegistrationNumber", "invalid_fk", f"Student registration '{reg_no}' does not exist in students directory.", "Register/add the student first or leave registration_number empty for whole-batch enrollment.")

            if course_obj and batch_obj:
                enr_key = (course_obj["id"], batch_obj["id"], section, student_id or "")
                dup_str = f"enr:{enr_key[0]}:{enr_key[1]}:{enr_key[2]}:{enr_key[3]}"
                if dup_str in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_str]
                    if duplicate_mode == "stop":
                        add_err("courseCode", "duplicate", f"Duplicate enrollment ({course_code} / {batch_code}-{section}) already on row {first_line}.", "Remove duplicate rows or select Skip mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("courseCode", f"Duplicate enrollment in CSV (line {first_line}); skipped.")
                else:
                    in_file_seen_keys[dup_str] = row_num

                existing = ctx["enrollment_by_key"].get(enr_key)
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("courseCode", "duplicate", f"Enrollment for {course_code} / {batch_code}-{section} already exists.", "Select Skip or Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("courseCode", f"Enrollment already exists; skipped.")
                    else:
                        action = "update"
                        payload = {"section": section, "enrolled_at": now_iso()}
                        diffs = _compute_diffs(existing, payload, [("section", "Section")])
                        field_diffs.append({"row": row_num, "identifier": f"{course_code} -> {batch_code}", "entity": "Enrollment", "diffs": diffs})
                        row_op = {"entity": "course_enrollments", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "courseCode": course_code, "batchCode": batch_code}
                elif not errors and action == "create":
                    new_id = str(uuid.uuid4())
                    payload = {
                        "id": new_id,
                        "institution_id": institution_id,
                        "course_id": course_obj["id"],
                        "batch_id": batch_obj["id"],
                        "student_id": student_id,
                        "section": section,
                        "enrolled_at": now_iso(),
                    }
                    row_op = {"entity": "course_enrollments", "action": "create", "id": new_id, "payload": payload, "courseCode": course_code, "batchCode": batch_code}
            stable_id = f"{course_code}->{batch_code}-{section}"

        elif category == "course_assignments":
            course_code = mapped_vals.get("courseCode", "").upper()
            batch_code = mapped_vals.get("batchCode", "").upper()
            section_code = (mapped_vals.get("sectionCode", "") or "A").upper()
            inst_raw = mapped_vals.get("instructor", "")
            lab_eng_raw = mapped_vals.get("labEngineer", "")
            sess_type_raw = mapped_vals.get("sessionType", "") or "Theory"
            spw_raw = mapped_vals.get("sessionsPerWeek", "")
            dur_raw = mapped_vals.get("durationMinutes", "")
            exp_raw = mapped_vals.get("expectedStudents", "")
            rtype_raw = (mapped_vals.get("requiredRoomType", "") or "").lower()

            course_obj = staged_courses_by_code.get(course_code) if course_code else None
            batch_obj = staged_batches_by_code.get(batch_code) if batch_code else None
            inst_obj = resolve_instructor(inst_raw) if inst_raw else None
            lab_eng_obj = resolve_instructor(lab_eng_raw) if lab_eng_raw else None

            if not course_code:
                add_err("courseCode", "missing_required", "Course code is required.", "Enter an existing course code.")
            elif not course_obj:
                add_err("courseCode", "invalid_fk", f"Course '{course_code}' does not exist.", "Import courses before course assignments.")

            if not batch_code:
                add_err("batchCode", "missing_required", "Batch code is required.", "Enter an existing batch/cohort code.")
            elif not batch_obj:
                add_err("batchCode", "invalid_fk", f"Batch '{batch_code}' does not exist.", "Import batches before course assignments.")

            if not inst_raw:
                add_err("instructor", "missing_required", "Instructor is required for a course assignment.", "Provide instructor email or exact full name.")
            elif not inst_obj:
                add_err("instructor", "invalid_fk", f"Instructor '{inst_raw}' not found.", "Import instructors first or enter exact email.")

            if lab_eng_raw and not lab_eng_obj:
                add_err("labEngineer", "invalid_fk", f"Lab engineer '{lab_eng_raw}' not found.", "Import instructors first or enter exact email.")

            sess_type = "Theory"
            st_low = sess_type_raw.lower()
            if st_low in ("theory", "lecture"):
                sess_type = "Theory"
            elif st_low == "lab":
                sess_type = "Lab"
            elif st_low == "tutorial":
                sess_type = "Tutorial"
            else:
                add_err("sessionType", "invalid_type", f"Invalid session type '{sess_type_raw}'.", "Allowed values: Theory, Lab, Tutorial.")

            spw = 1 if sess_type == "Lab" else 3
            if spw_raw:
                try:
                    spw = parse_strict_int(spw_raw, "Sessions per week", min_val=1, max_val=6)
                except ValueError as exc:
                    add_err("sessionsPerWeek", "invalid_type", str(exc), "Enter integer 1–6.")

            dur = 180 if sess_type == "Lab" else 50
            if dur_raw:
                try:
                    dur = parse_strict_int(dur_raw, "Duration minutes", min_val=30, max_val=300)
                except ValueError as exc:
                    add_err("durationMinutes", "invalid_type", str(exc), "Enter integer 30–300.")

            expected_students = int(batch_obj.get("student_count") or 45) if batch_obj else 45
            if exp_raw:
                try:
                    expected_students = parse_strict_int(exp_raw, "Expected students", min_val=1, max_val=1000)
                except ValueError as exc:
                    add_err("expectedStudents", "invalid_type", str(exc), "Enter integer 1–1000.")

            req_room_type = rtype_raw or ("lab" if sess_type == "Lab" else "lecture")
            if req_room_type not in ("lecture", "lab", "seminar"):
                add_err("requiredRoomType", "invalid_type", f"Invalid room type '{req_room_type}'.", "Allowed: lecture, lab, seminar.")

            if course_obj and batch_obj and inst_obj:
                s_key = (course_obj["id"], batch_obj["id"], section_code, sess_type.lower())
                dup_str = f"sess:{s_key[0]}:{s_key[1]}:{s_key[2]}:{s_key[3]}"
                if dup_str in in_file_seen_keys:
                    duplicate_cnt += 1
                    first_line = in_file_seen_keys[dup_str]
                    if duplicate_mode == "stop":
                        add_err("courseCode", "duplicate", f"Duplicate assignment ({course_code} / {batch_code}-{section_code} {sess_type}) on row {first_line}.", "Remove duplicate rows or switch duplicate mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("courseCode", f"Duplicate assignment in CSV (line {first_line}); skipped.")
                else:
                    in_file_seen_keys[dup_str] = row_num

                existing = ctx["session_by_key"].get(s_key)
                comp_type = "lab" if sess_type == "Lab" else ("tutorial" if sess_type == "Tutorial" else "lecture")
                if not errors and existing and action != "skip":
                    duplicate_cnt += 1
                    if duplicate_mode == "stop":
                        add_err("courseCode", "duplicate", f"Course assignment {course_code} / {batch_code}-{section_code} ({sess_type}) already exists.", "Select Skip or Update mode.")
                    elif duplicate_mode == "skip":
                        action = "skip"
                        add_warn("courseCode", f"Assignment already exists; skipped.")
                    else:
                        action = "update"
                        payload = {
                            "instructor_id": inst_obj["id"],
                            "lab_engineer_id": lab_eng_obj["id"] if lab_eng_obj else None,
                            "sessions_per_week": spw,
                            "duration_minutes": dur,
                            "expected_students": expected_students,
                            "required_room_type": req_room_type,
                            "component_type": comp_type,
                        }
                        diffs = _compute_diffs(existing, payload, [("instructor_id", "Instructor ID"), ("sessions_per_week", "Sessions / Week"), ("duration_minutes", "Duration (min)"), ("expected_students", "Expected Students"), ("required_room_type", "Room Type")])
                        field_diffs.append({"row": row_num, "identifier": f"{course_code} ({batch_code}-{section_code})", "entity": "Course Assignment", "diffs": diffs})
                        row_op = {"entity": "course_sessions", "action": "update", "id": existing["id"], "match": {"id": f"eq.{existing['id']}"}, "payload": payload, "before": existing, "courseId": course_obj["id"], "batchId": batch_obj["id"], "instructorId": inst_obj["id"]}
                elif not errors and action == "create":
                    new_id = f"sec-{uuid.uuid4().hex[:8]}"
                    payload = {
                        "id": new_id,
                        "institution_id": institution_id,
                        "course_id": course_obj["id"],
                        "instructor_id": inst_obj["id"],
                        "lab_engineer_id": lab_eng_obj["id"] if lab_eng_obj else None,
                        "batch_id": batch_obj["id"],
                        "section_code": section_code,
                        "session_type": sess_type,
                        "component_type": comp_type,
                        "sessions_per_week": spw,
                        "duration_minutes": dur,
                        "expected_students": expected_students,
                        "required_room_type": req_room_type,
                        "required_equipment": [],
                        "created_at": now_iso(),
                    }
                    row_op = {"entity": "course_sessions", "action": "create", "id": new_id, "payload": payload, "courseId": course_obj["id"], "batchId": batch_obj["id"], "instructorId": inst_obj["id"]}
            stable_id = f"{course_code}/{batch_code}-{section_code}"

        elif category == "all":
            # Master file: validate and stage any populated entity columns per row
            # 1) Department fields
            dept_code = mapped_vals.get("deptCode", "").upper()
            dept_name = mapped_vals.get("deptName", "") or dept_code
            school = mapped_vals.get("school", "") or "Engineering & Computing"
            dept_hod = mapped_vals.get("headOfDepartment", "")
            sub_depts = split_list_value(mapped_vals.get("subDepartments", ""))

            # 2) Room / Lab fields
            room_code = mapped_vals.get("roomCode", "").upper()
            room_name = mapped_vals.get("roomName", "") or room_code
            room_cap_raw = mapped_vals.get("roomCapacity", "")
            room_type_raw = (mapped_vals.get("roomType", "") or "").lower()
            building = mapped_vals.get("building", "") or "Main Academic Block"
            floor_raw = mapped_vals.get("floor", "")
            lab_cat = mapped_vals.get("labCategory", "") or "Computing"
            room_lab_eng_raw = mapped_vals.get("roomLabEngineer", "")
            room_equip = split_list_value(mapped_vals.get("equipment", ""))
            room_avail_raw = mapped_vals.get("roomIsAvailable", "")

            # 3) Instructor fields
            inst_name = mapped_vals.get("instructorName", "")
            inst_email = mapped_vals.get("instructorEmail", "").lower()
            inst_title = mapped_vals.get("instructorTitle", "")
            staff_role_raw = (mapped_vals.get("staffRole", "") or "faculty").lower()
            inst_sub_dept = mapped_vals.get("instructorSubDepartment", "")
            max_wk_raw = mapped_vals.get("maxWeeklyHours", "")
            max_day_raw = mapped_vals.get("maxDailyClasses", "")
            qual_courses = [c.upper() for c in split_list_value(mapped_vals.get("qualifiedCourses", ""))]

            # 4) Course fields
            course_code = mapped_vals.get("courseCode", "").upper()
            course_title = mapped_vals.get("courseTitle", "")
            ctype_raw = (mapped_vals.get("courseType", "") or "").lower()
            cr_raw = mapped_vals.get("creditHours", "")
            lec_raw = mapped_vals.get("lectureCredits", "")
            lab_raw = mapped_vals.get("labCredits", "")
            lab_mode_raw = (mapped_vals.get("labSessionMode", "") or "continuous").lower()
            comp_raw = mapped_vals.get("isCompulsory", "")
            elec_raw = mapped_vals.get("isElective", "")
            pool_name = mapped_vals.get("electivePoolName", "")
            assigned_inst_raw = mapped_vals.get("assignedInstructor", "")
            assigned_lab_eng_raw = mapped_vals.get("assignedLabEngineer", "")
            req_equip = split_list_value(mapped_vals.get("requiredEquipment", ""))
            course_sub_dept = mapped_vals.get("courseSubDepartment", "")
            course_sem_raw = mapped_vals.get("courseSemester", "")

            # 5) Batch & Section fields
            cohort_code_raw = mapped_vals.get("cohortCode", "").upper()
            batch_code_raw = mapped_vals.get("batchCode", "").upper()
            section_raw = mapped_vals.get("section", "").upper()
            cohort_name_raw = mapped_vals.get("cohortName", "")
            cohort_size_raw = mapped_vals.get("cohortSize", "")
            year_raw = mapped_vals.get("year", "")
            sem_raw = mapped_vals.get("semester", "")
            home_room_raw = mapped_vals.get("homeRoom", "").upper()

            # 6) Course Assignment & Enrollment fields
            sess_type_raw = mapped_vals.get("sessionType", "")
            spw_raw = mapped_vals.get("sessionsPerWeek", "")
            dur_raw = mapped_vals.get("durationMinutes", "")
            exp_raw = mapped_vals.get("expectedStudents", "")
            req_rtype_raw = (mapped_vals.get("requiredRoomType", "") or "").lower()
            reg_no = mapped_vals.get("studentRegistrationNumber", "").upper()

            # Resolve cohort_code, batch_code, and section seamlessly
            cohort_code = ""
            eff_batch_code = ""
            eff_section = section_raw
            if cohort_code_raw:
                cohort_code = cohort_code_raw
                eff_batch_code = batch_code_raw or (cohort_code.split("-")[0] if "-" in cohort_code else cohort_code)
                if not eff_section:
                    eff_section = cohort_code.split("-")[-1] if "-" in cohort_code and len(cohort_code.split("-")) >= 2 else "A"
            elif batch_code_raw:
                if "-" in batch_code_raw and len(batch_code_raw.split("-")) >= 3:
                    cohort_code = batch_code_raw
                    eff_batch_code = batch_code_raw.split("-")[0]
                    if not eff_section:
                        eff_section = batch_code_raw.split("-")[-1]
                elif "-" in batch_code_raw and len(batch_code_raw.split("-")) == 2:
                    eff_section = eff_section or "A"
                    cohort_code = f"{batch_code_raw}-{eff_section}"
                    eff_batch_code = batch_code_raw.split("-")[0]
                else:
                    eff_batch_code = batch_code_raw
                    eff_section = eff_section or "A"
                    cohort_code = f"{eff_batch_code}-{dept_code}-{eff_section}" if dept_code else f"{eff_batch_code}-{eff_section}"
            elif section_raw and (dept_code or year_raw or sem_raw):
                eff_batch_code = f"SEM{sem_raw}" if sem_raw else f"Y{year_raw or 1}"
                eff_section = section_raw
                cohort_code = f"{eff_batch_code}-{dept_code}-{eff_section}" if dept_code else f"{eff_batch_code}-{eff_section}"
            else:
                eff_section = eff_section or "A"

            if not any([dept_code, room_code, course_code, inst_name, inst_email, cohort_code, batch_code_raw]):
                add_err("courseCode", "missing_required", "Row contains no recognizable department, room, course, instructor, or batch/cohort identifier.", "Populate at least one entity identifier on this row.")

            # Validate Room fields
            room_cap_val = 50
            if room_cap_raw:
                try:
                    room_cap_val = parse_strict_int(room_cap_raw, "Room capacity", min_val=1, max_val=2000)
                except ValueError as exc:
                    add_err("roomCapacity", "invalid_type", str(exc), "Use integer 1–2000.")
            room_floor_val = 1
            if floor_raw:
                try:
                    room_floor_val = parse_strict_int(floor_raw, "Floor", min_val=-5, max_val=100)
                except ValueError as exc:
                    add_err("floor", "invalid_type", str(exc), "Enter a valid floor integer (-5 to 100).")
            room_is_avail = True
            if room_avail_raw:
                try:
                    room_is_avail = bool(parse_strict_bool(room_avail_raw, default=True))
                except ValueError as exc:
                    add_err("roomIsAvailable", "invalid_type", str(exc), "Use yes/no or true/false.")
            if room_type_raw and room_type_raw not in ("lecture", "classroom", "hall", "theory", "seminar", "tutorial", "auditorium", "amphitheater", "amphitheatre", "studio", "lab", "laboratory", "computing"):
                add_err("roomType", "invalid_type", f"Unsupported room type '{room_type_raw}'.", "Allowed values: lecture, seminar, auditorium, studio, or lab.")

            # Validate Instructor fields
            if inst_email and not EMAIL_RE.match(inst_email):
                add_err("instructorEmail", "invalid_type", f"Invalid email '{inst_email}'.", "Use valid email address.")
            staff_role = "faculty"
            if staff_role_raw in ("faculty", "professor", "lecturer", "instructor", "teacher", ""):
                staff_role = "faculty"
            elif staff_role_raw in ("lab_engineer", "lab engineer", "engineer", "demonstrator", "ta"):
                staff_role = "lab_engineer"
            else:
                add_err("staffRole", "invalid_type", f"Unsupported staff role '{staff_role_raw}'.", "Allowed values: faculty or lab_engineer.")
            max_weekly_val = 18 if staff_role == "lab_engineer" else 15
            if max_wk_raw:
                try:
                    max_weekly_val = parse_strict_int(max_wk_raw, "Max weekly hours", min_val=1, max_val=45)
                except ValueError as exc:
                    add_err("maxWeeklyHours", "invalid_type", str(exc), "Enter integer 1–45.")
            max_daily_val = 4
            if max_day_raw:
                try:
                    max_daily_val = parse_strict_int(max_day_raw, "Max daily classes", min_val=1, max_val=10)
                except ValueError as exc:
                    add_err("maxDailyClasses", "invalid_type", str(exc), "Enter integer 1–10.")

            # Validate Course fields
            if ctype_raw and ctype_raw not in ("lecture", "theory", "lab", "lecture_lab", "lecture+lab", "both"):
                add_err("courseType", "invalid_type", f"Invalid course type '{ctype_raw}'.", "Allowed values: lecture, lab, lecture_lab.")
            if lab_mode_raw not in ("continuous", "split_allowed"):
                add_err("labSessionMode", "invalid_type", f"Invalid lab session mode '{lab_mode_raw}'.", "Allowed values: continuous or split_allowed.")
            lec_cr_val: Optional[int] = None
            lab_cr_val: Optional[int] = None
            total_cr_val: Optional[int] = None
            if lec_raw:
                try:
                    lec_cr_val = parse_strict_int(lec_raw, "Lecture credits", min_val=0, max_val=6)
                except ValueError as exc:
                    add_err("lectureCredits", "invalid_type", str(exc), "Enter integer 0–6.")
            if lab_raw:
                try:
                    lab_cr_val = parse_strict_int(lab_raw, "Lab credits", min_val=0, max_val=4)
                except ValueError as exc:
                    add_err("labCredits", "invalid_type", str(exc), "Enter integer 0–4.")
            if cr_raw:
                try:
                    total_cr_val = parse_strict_int(cr_raw, "Credit hours", min_val=1, max_val=6)
                except ValueError as exc:
                    add_err("creditHours", "invalid_type", str(exc), "Enter integer 1–6.")
            is_compulsory_val = True
            try:
                comp_parsed = parse_strict_bool(comp_raw, default=None) if comp_raw else None
                elec_parsed = parse_strict_bool(elec_raw, default=None) if elec_raw else None
                if elec_parsed is not None:
                    is_compulsory_val = not elec_parsed
                elif comp_parsed is not None:
                    is_compulsory_val = comp_parsed
            except ValueError as exc:
                add_err("isElective" if elec_raw else "isCompulsory", "invalid_type", str(exc), "Use yes/no or true/false.")

            # Validate Batch & Section fields
            cohort_size_val = 45
            if cohort_size_raw:
                try:
                    cohort_size_val = parse_strict_int(cohort_size_raw, "Cohort size", min_val=1, max_val=1000)
                except ValueError as exc:
                    add_err("cohortSize", "invalid_type", str(exc), "Use integer 1–1000.")
            year_val = 1
            if year_raw:
                try:
                    year_val = parse_strict_int(year_raw, "Academic year", min_val=1, max_val=8)
                except ValueError as exc:
                    add_err("year", "invalid_type", str(exc), "Enter integer 1–8.")
            sem_val = 1
            if sem_raw:
                try:
                    sem_val = parse_strict_int(sem_raw, "Semester", min_val=1, max_val=16)
                except ValueError as exc:
                    add_err("semester", "invalid_type", str(exc), "Enter integer 1–16.")
            course_sem_val: Optional[int] = None
            if course_sem_raw:
                try:
                    course_sem_val = parse_strict_int(course_sem_raw, "Course semester", min_val=1, max_val=16)
                except ValueError as exc:
                    add_err("courseSemester", "invalid_type", str(exc), "Enter integer 1–16.")

            # Validate Assignment & Enrollment fields
            sess_type = "Theory"
            if sess_type_raw:
                st_low = sess_type_raw.lower()
                if st_low in ("theory", "lecture"):
                    sess_type = "Theory"
                elif st_low == "lab":
                    sess_type = "Lab"
                elif st_low == "tutorial":
                    sess_type = "Tutorial"
                else:
                    add_err("sessionType", "invalid_type", f"Invalid session type '{sess_type_raw}'.", "Allowed values: Theory, Lab, Tutorial.")
            spw_val = 1 if sess_type == "Lab" else 3
            if spw_raw:
                try:
                    spw_val = parse_strict_int(spw_raw, "Sessions per week", min_val=1, max_val=6)
                except ValueError as exc:
                    add_err("sessionsPerWeek", "invalid_type", str(exc), "Enter integer 1–6.")
            dur_val = 180 if sess_type == "Lab" else 50
            if dur_raw:
                try:
                    dur_val = parse_strict_int(dur_raw, "Duration minutes", min_val=30, max_val=300)
                except ValueError as exc:
                    add_err("durationMinutes", "invalid_type", str(exc), "Enter integer 30–300.")
            exp_students_val = cohort_size_val
            if exp_raw:
                try:
                    exp_students_val = parse_strict_int(exp_raw, "Expected students", min_val=1, max_val=1000)
                except ValueError as exc:
                    add_err("expectedStudents", "invalid_type", str(exc), "Enter integer 1–1000.")
            req_rtype_val = req_rtype_raw or ("lab" if sess_type == "Lab" else "lecture")
            if req_rtype_raw and req_rtype_raw not in ("lecture", "lab", "seminar"):
                add_err("requiredRoomType", "invalid_type", f"Invalid room type '{req_rtype_raw}'.", "Allowed: lecture, lab, seminar.")

            sub_ops: List[Dict[str, Any]] = []
            if not errors:
                # 1) Department
                active_dept_id = None
                if dept_code:
                    existing_d = staged_depts_by_code.get(dept_code)
                    if not existing_d:
                        d_id = f"dept-{uuid.uuid4().hex[:8]}"
                        d_pay = {
                            "id": d_id,
                            "institution_id": institution_id,
                            "code": dept_code,
                            "name": dept_name,
                            "school": school,
                            "faculty_name": school,
                            "head_of_department": dept_hod,
                            "sub_departments": sub_depts,
                            "created_at": now_iso(),
                        }
                        staged_depts_by_code[dept_code] = d_pay
                        in_file_all_entities.add(f"dept:{dept_code}")
                        sub_ops.append({"entity": "departments", "action": "create", "id": d_id, "payload": d_pay, "subDepartments": sub_depts, "code": dept_code})
                        active_dept_id = d_id
                    else:
                        active_dept_id = existing_d["id"]
                        if duplicate_mode == "update" and f"dept:{dept_code}" not in in_file_all_entities and dept_code in ctx["dept_by_code"]:
                            in_file_all_entities.add(f"dept:{dept_code}")
                            d_upd = {
                                "name": mapped_vals.get("deptName", "") or existing_d.get("name") or dept_code,
                                "school": mapped_vals.get("school", "") or existing_d.get("school") or school,
                                "faculty_name": mapped_vals.get("school", "") or existing_d.get("faculty_name") or school,
                                "head_of_department": dept_hod or existing_d.get("head_of_department") or "",
                                "sub_departments": sub_depts or existing_d.get("sub_departments") or [],
                            }
                            diffs = _compute_diffs(existing_d, d_upd, [("name", "Department Name"), ("faculty_name", "School / Faculty"), ("head_of_department", "Head of Department")])
                            if diffs:
                                field_diffs.append({"row": row_num, "identifier": dept_code, "entity": "Department", "diffs": diffs})
                                sub_ops.append({"entity": "departments", "action": "update", "id": existing_d["id"], "match": {"id": f"eq.{existing_d['id']}"}, "payload": d_upd, "before": existing_d, "subDepartments": sub_depts, "code": dept_code})

                # 2) Instructor (staged before rooms/labs and courses so room_lab_engineer / assigned_instructor can resolve same-row)
                active_inst_id = None
                if inst_name or inst_email:
                    eff_email = inst_email or f"{re.sub(r'[^a-z0-9]+', '.', inst_name.lower()).strip('.')}@university.edu"
                    existing_i = (
                        staged_inst_by_email.get(eff_email)
                        if inst_email
                        else (staged_inst_by_email.get(eff_email) or (staged_inst_by_name.get(inst_name.lower()) if inst_name else None))
                    )
                    eff_designation = inst_title or ("Lab Engineer" if staff_role == "lab_engineer" else "Assistant Professor")
                    if not existing_i:
                        i_id = f"inst-fac-{uuid.uuid4().hex[:8]}"
                        i_pay = {
                            "id": i_id,
                            "institution_id": institution_id,
                            "department_id": active_dept_id,
                            "sub_department": inst_sub_dept or None,
                            "name": inst_name or eff_email.split("@")[0],
                            "email": eff_email,
                            "designation": eff_designation,
                            "staff_role": staff_role,
                            "max_weekly_hours": max_weekly_val,
                            "max_daily_classes": max_daily_val,
                            "specializations": qual_courses,
                            "created_at": now_iso(),
                        }
                        staged_inst_by_email[eff_email] = i_pay
                        if inst_name:
                            staged_inst_by_name[inst_name.lower()] = i_pay
                        in_file_all_entities.add(f"inst:{eff_email}")
                        sub_ops.append({"entity": "instructors", "action": "create", "id": i_id, "payload": i_pay, "staffRole": staff_role, "subDepartment": inst_sub_dept, "qualifiedCourses": qual_courses})
                        active_inst_id = i_id
                    else:
                        active_inst_id = existing_i["id"]
                        if duplicate_mode == "update" and f"inst:{eff_email}" not in in_file_all_entities and eff_email in ctx["inst_by_email"]:
                            in_file_all_entities.add(f"inst:{eff_email}")
                            i_upd = {
                                "name": inst_name or existing_i.get("name"),
                                "department_id": active_dept_id or existing_i.get("department_id"),
                                "sub_department": inst_sub_dept or existing_i.get("sub_department"),
                                "designation": inst_title or existing_i.get("designation") or eff_designation,
                                "staff_role": staff_role,
                                "max_weekly_hours": int(max_wk_raw) if max_wk_raw else existing_i.get("max_weekly_hours", max_weekly_val),
                                "max_daily_classes": int(max_day_raw) if max_day_raw else existing_i.get("max_daily_classes", max_daily_val),
                                "specializations": qual_courses or existing_i.get("specializations") or [],
                            }
                            diffs = _compute_diffs(existing_i, i_upd, [("name", "Full Name"), ("designation", "Designation"), ("staff_role", "Staff Role"), ("max_weekly_hours", "Max Weekly Hours"), ("max_daily_classes", "Max Daily Classes")])
                            if diffs:
                                field_diffs.append({"row": row_num, "identifier": eff_email, "entity": "Instructor", "diffs": diffs})
                                sub_ops.append({"entity": "instructors", "action": "update", "id": existing_i["id"], "match": {"id": f"eq.{existing_i['id']}"}, "payload": i_upd, "before": existing_i, "staffRole": staff_role, "subDepartment": inst_sub_dept, "qualifiedCourses": qual_courses})

                # 3) Room or Laboratory
                if room_code:
                    room_lab_eng_id = None
                    if room_lab_eng_raw:
                        eng_obj = resolve_instructor(room_lab_eng_raw)
                        if not eng_obj:
                            add_err("roomLabEngineer", "invalid_fk", f"Room/Lab engineer '{room_lab_eng_raw}' not found.", "Import instructors first or enter an existing instructor email/name.")
                        else:
                            room_lab_eng_id = eng_obj["id"]

                    if not errors:
                        existing_r = staged_rooms_by_code.get(room_code)
                        is_lab_room = "lab" in room_type_raw or "lab" in room_code.lower() or (bool(mapped_vals.get("labCategory", "")) and not room_type_raw)
                        norm_room_type = "seminar" if room_type_raw in ("seminar", "tutorial") else ("auditorium" if room_type_raw in ("auditorium", "amphitheater", "amphitheatre") else ("studio" if room_type_raw == "studio" else "lecture"))
                        if not existing_r:
                            if is_lab_room:
                                r_id = f"lab-{uuid.uuid4().hex[:8]}"
                                r_pay = {
                                    "id": r_id,
                                    "institution_id": institution_id,
                                    "department_id": active_dept_id,
                                    "code": room_code,
                                    "name": room_name,
                                    "building": building,
                                    "capacity": room_cap_val,
                                    "lab_category": lab_cat,
                                    "assigned_lab_engineer_id": room_lab_eng_id,
                                    "equipment": room_equip,
                                    "is_available": room_is_avail,
                                    "created_at": now_iso(),
                                }
                                staged_rooms_by_code[room_code] = r_pay
                                in_file_all_entities.add(f"room:{room_code}")
                                sub_ops.append({"entity": "laboratories", "action": "create", "id": r_id, "payload": r_pay, "equipment": room_equip, "code": room_code})
                            else:
                                r_id = f"room-{uuid.uuid4().hex[:8]}"
                                r_pay = {
                                    "id": r_id,
                                    "institution_id": institution_id,
                                    "code": room_code,
                                    "name": room_name,
                                    "building": building,
                                    "floor": room_floor_val,
                                    "capacity": room_cap_val,
                                    "room_type": norm_room_type,
                                    "is_available": room_is_avail,
                                    "created_at": now_iso(),
                                }
                                staged_rooms_by_code[room_code] = r_pay
                                in_file_all_entities.add(f"room:{room_code}")
                                sub_ops.append({"entity": "classrooms", "action": "create", "id": r_id, "payload": r_pay, "equipment": room_equip, "code": room_code})
                        elif duplicate_mode == "update" and f"room:{room_code}" not in in_file_all_entities:
                            if room_code in ctx["lab_by_code"]:
                                in_file_all_entities.add(f"room:{room_code}")
                                l_upd = {
                                    "name": mapped_vals.get("roomName", "") or existing_r.get("name") or room_code,
                                    "building": mapped_vals.get("building", "") or existing_r.get("building") or building,
                                    "capacity": int(room_cap_raw) if room_cap_raw else existing_r.get("capacity", room_cap_val),
                                    "lab_category": mapped_vals.get("labCategory", "") or existing_r.get("lab_category") or lab_cat,
                                    "department_id": active_dept_id or existing_r.get("department_id"),
                                    "assigned_lab_engineer_id": room_lab_eng_id or existing_r.get("assigned_lab_engineer_id"),
                                    "equipment": room_equip or existing_r.get("equipment") or [],
                                    "is_available": room_is_avail if room_avail_raw else existing_r.get("is_available", True),
                                }
                                diffs = _compute_diffs(existing_r, l_upd, [("name", "Lab Name"), ("capacity", "Capacity"), ("lab_category", "Category"), ("is_available", "Available")])
                                if diffs:
                                    field_diffs.append({"row": row_num, "identifier": room_code, "entity": "Laboratory", "diffs": diffs})
                                    sub_ops.append({"entity": "laboratories", "action": "update", "id": existing_r["id"], "match": {"id": f"eq.{existing_r['id']}"}, "payload": l_upd, "before": existing_r, "equipment": room_equip, "code": room_code})
                            elif room_code in ctx["room_by_code"]:
                                in_file_all_entities.add(f"room:{room_code}")
                                r_upd = {
                                    "name": mapped_vals.get("roomName", "") or existing_r.get("name") or room_code,
                                    "building": mapped_vals.get("building", "") or existing_r.get("building") or building,
                                    "floor": int(floor_raw) if floor_raw else existing_r.get("floor", 1),
                                    "capacity": int(room_cap_raw) if room_cap_raw else existing_r.get("capacity", room_cap_val),
                                    "room_type": norm_room_type if room_type_raw else existing_r.get("room_type", "lecture"),
                                    "is_available": room_is_avail if room_avail_raw else existing_r.get("is_available", True),
                                }
                                diffs = _compute_diffs(existing_r, r_upd, [("name", "Room Name"), ("floor", "Floor"), ("capacity", "Capacity"), ("room_type", "Room Type"), ("is_available", "Available")])
                                if diffs:
                                    field_diffs.append({"row": row_num, "identifier": room_code, "entity": "Classroom", "diffs": diffs})
                                    sub_ops.append({"entity": "classrooms", "action": "update", "id": existing_r["id"], "match": {"id": f"eq.{existing_r['id']}"}, "payload": r_upd, "before": existing_r, "equipment": room_equip, "code": room_code})

                # Resolve course staff FKs
                course_inst_id = active_inst_id if (active_inst_id and staff_role != "lab_engineer") else None
                if assigned_inst_raw:
                    c_inst_obj = resolve_instructor(assigned_inst_raw)
                    if not c_inst_obj:
                        add_err("assignedInstructor", "invalid_fk", f"Assigned instructor '{assigned_inst_raw}' not found.", "Import instructors first or enter a valid email/name.")
                    else:
                        course_inst_id = c_inst_obj["id"]

                course_lab_eng_id = active_inst_id if (active_inst_id and staff_role == "lab_engineer") else None
                if assigned_lab_eng_raw:
                    c_eng_obj = resolve_instructor(assigned_lab_eng_raw)
                    if not c_eng_obj:
                        add_err("assignedLabEngineer", "invalid_fk", f"Assigned lab engineer '{assigned_lab_eng_raw}' not found.", "Import instructors first or enter a valid email/name.")
                    else:
                        course_lab_eng_id = c_eng_obj["id"]

                # 4) Course
                active_course_id = None
                if course_code and not errors:
                    if lec_cr_val is None and lab_cr_val is None:
                        base_cr = total_cr_val if total_cr_val is not None else 3
                        if ctype_raw == "lab":
                            lec_cr_eff, lab_cr_eff = 0, min(4, base_cr)
                        elif ctype_raw in ("lecture_lab", "lecture+lab", "both"):
                            lec_cr_eff, lab_cr_eff = max(1, base_cr - 1), 1
                        else:
                            lec_cr_eff, lab_cr_eff = base_cr, 0
                    else:
                        lec_cr_eff = lec_cr_val or 0
                        lab_cr_eff = lab_cr_val or 0

                    if lec_cr_eff + lab_cr_eff <= 0:
                        add_err("creditHours", "invalid_type", "Course must have at least 1 lecture or lab credit hour.", "Set lecture_credits or lab_credits >= 1.")

                    eff_total_cr = min(6, max(1, total_cr_val or (lec_cr_eff + lab_cr_eff)))
                    eff_c_type = "lecture_lab" if (lec_cr_eff > 0 and lab_cr_eff > 0) else ("lab" if lab_cr_eff > 0 else "lecture")

                    eff_course_sem = course_sem_val if course_sem_val is not None else (sem_val if sem_raw else None)
                    existing_c = staged_courses_by_code.get(course_code)
                    if not existing_c and not errors:
                        c_id = f"crs-{uuid.uuid4().hex[:8]}"
                        if eff_course_sem is not None:
                            staged_course_inferred_sems[course_code].add(eff_course_sem)
                        staged_new_course_codes.add(course_code)
                        c_pay = {
                            "id": c_id,
                            "institution_id": institution_id,
                            "department_id": active_dept_id,
                            "sub_department": course_sub_dept or None,
                            "code": course_code,
                            "title": course_title or course_code,
                            "credit_hours": eff_total_cr,
                            "lecture_hours_per_week": lec_cr_eff,
                            "lab_hours_per_week": lab_cr_eff * 3,
                            "course_type": eff_c_type,
                            "lecture_credit_hours": lec_cr_eff,
                            "lab_credit_hours": lab_cr_eff,
                            "assigned_instructor_id": course_inst_id,
                            "assigned_lab_engineer_id": course_lab_eng_id,
                            "lab_session_mode": lab_mode_raw,
                            "is_compulsory": is_compulsory_val,
                            "is_elective": not is_compulsory_val,
                            "elective_pool_name": pool_name or None,
                            "required_room_type": "lab" if eff_c_type == "lab" else "lecture",
                            "required_equipment": req_equip,
                            "semester_number": eff_course_sem,
                            "created_at": now_iso(),
                        }
                        staged_courses_by_code[course_code] = c_pay
                        in_file_all_entities.add(f"course:{course_code}")
                        sub_ops.append({"entity": "courses", "action": "create", "id": c_id, "payload": c_pay, "electivePoolName": pool_name, "deptCode": dept_code})
                        active_course_id = c_id
                    elif existing_c and not errors:
                        active_course_id = existing_c["id"]
                        if course_code in staged_new_course_codes and eff_course_sem is not None and course_sem_val is None:
                            staged_course_inferred_sems[course_code].add(eff_course_sem)
                            if len(staged_course_inferred_sems[course_code]) > 1:
                                existing_c["semester_number"] = None
                        if duplicate_mode == "update" and f"course:{course_code}" not in in_file_all_entities and course_code in ctx["course_by_code"]:
                            in_file_all_entities.add(f"course:{course_code}")
                            c_upd = {
                                "title": course_title or existing_c.get("title") or course_code,
                                "department_id": active_dept_id or existing_c.get("department_id"),
                                "sub_department": course_sub_dept or existing_c.get("sub_department"),
                                "credit_hours": eff_total_cr if (lec_raw or lab_raw or cr_raw) else existing_c.get("credit_hours", eff_total_cr),
                                "lecture_hours_per_week": lec_cr_eff if (lec_raw or lab_raw or cr_raw) else existing_c.get("lecture_hours_per_week", lec_cr_eff),
                                "lab_hours_per_week": (lab_cr_eff * 3) if (lec_raw or lab_raw or cr_raw) else existing_c.get("lab_hours_per_week", 0),
                                "course_type": eff_c_type if (ctype_raw or lec_raw or lab_raw) else existing_c.get("course_type", eff_c_type),
                                "lecture_credit_hours": lec_cr_eff if (lec_raw or lab_raw or cr_raw) else existing_c.get("lecture_credit_hours", lec_cr_eff),
                                "lab_credit_hours": lab_cr_eff if (lec_raw or lab_raw or cr_raw) else existing_c.get("lab_credit_hours", lab_cr_eff),
                                "assigned_instructor_id": course_inst_id or existing_c.get("assigned_instructor_id"),
                                "assigned_lab_engineer_id": course_lab_eng_id or existing_c.get("assigned_lab_engineer_id"),
                                "lab_session_mode": lab_mode_raw if mapped_vals.get("labSessionMode") else existing_c.get("lab_session_mode", "continuous"),
                                "is_compulsory": is_compulsory_val if (comp_raw or elec_raw) else existing_c.get("is_compulsory", True),
                                "is_elective": (not is_compulsory_val) if (comp_raw or elec_raw) else existing_c.get("is_elective", False),
                                "elective_pool_name": pool_name or existing_c.get("elective_pool_name"),
                                "required_equipment": req_equip or existing_c.get("required_equipment") or [],
                                "semester_number": eff_course_sem if (course_sem_val is not None) else existing_c.get("semester_number"),
                            }
                            diffs = _compute_diffs(existing_c, c_upd, [("title", "Course Title"), ("credit_hours", "Credit Hours"), ("semester_number", "Semester"), ("is_compulsory", "Compulsory"), ("elective_pool_name", "Elective Pool")])
                            if diffs:
                                field_diffs.append({"row": row_num, "identifier": course_code, "entity": "Course", "diffs": diffs})
                                sub_ops.append({"entity": "courses", "action": "update", "id": existing_c["id"], "match": {"id": f"eq.{existing_c['id']}"}, "payload": c_upd, "before": existing_c, "electivePoolName": pool_name, "deptCode": dept_code})

                # 5) Cohort / Batch & Section
                if home_room_raw and home_room_raw not in staged_rooms_by_code:
                    add_err("homeRoom", "invalid_fk", f"Home room '{home_room_raw}' does not exist in rooms or laboratories.", "Include room_code or import rooms/labs first.")

                active_batch_id = None
                if cohort_code and not errors:
                    existing_b = staged_batches_by_code.get(cohort_code)
                    resolved_dept_code = dept_code or (cohort_code.split("-")[1] if "-" in cohort_code and len(cohort_code.split("-")) >= 2 else "GEN")
                    resolved_b_name = cohort_name_raw or (f"{eff_batch_code} {resolved_dept_code} Section {eff_section}".strip() if eff_batch_code else f"Cohort {cohort_code}")
                    if not existing_b:
                        b_id = f"batch-{uuid.uuid4().hex[:8]}"
                        b_pay = {
                            "id": b_id,
                            "code": cohort_code,
                            "batch_code": eff_batch_code or cohort_code,
                            "name": resolved_b_name,
                            "department_code": resolved_dept_code,
                            "year": year_val,
                            "semester": sem_val,
                            "student_count": cohort_size_val,
                            "section": eff_section,
                            "sections_list": eff_section,
                            "home_room": home_room_raw or None,
                            "institution_id": institution_id,
                            "created_at": now_iso(),
                        }
                        staged_batches_by_code[cohort_code] = b_pay
                        in_file_all_entities.add(f"batch:{cohort_code}")
                        sub_ops.append({"entity": "batches", "action": "create", "id": b_id, "payload": b_pay, "batchCode": eff_batch_code, "section": eff_section, "homeRoom": home_room_raw})
                        active_batch_id = b_id
                    else:
                        active_batch_id = existing_b["id"]
                        if duplicate_mode == "update" and f"batch:{cohort_code}" not in in_file_all_entities and cohort_code in ctx["batch_by_code"]:
                            in_file_all_entities.add(f"batch:{cohort_code}")
                            b_upd = {
                                "name": cohort_name_raw or existing_b.get("name") or resolved_b_name,
                                "batch_code": eff_batch_code or existing_b.get("batch_code") or cohort_code,
                                "department_code": dept_code or existing_b.get("department_code") or resolved_dept_code,
                                "year": int(year_raw) if year_raw else existing_b.get("year", 1),
                                "semester": int(sem_raw) if sem_raw else existing_b.get("semester", 1),
                                "student_count": int(cohort_size_raw) if cohort_size_raw else existing_b.get("student_count", 45),
                                "section": section_raw or existing_b.get("section") or eff_section,
                                "sections_list": section_raw or existing_b.get("sections_list") or eff_section,
                                "home_room": home_room_raw or existing_b.get("home_room") or None,
                            }
                            diffs = _compute_diffs(existing_b, b_upd, [("name", "Batch Name"), ("batch_code", "Batch Code"), ("section", "Section"), ("student_count", "Student Count"), ("semester", "Semester"), ("home_room", "Home Room")])
                            if diffs:
                                field_diffs.append({"row": row_num, "identifier": cohort_code, "entity": "Batch & Section", "diffs": diffs})
                                sub_ops.append({"entity": "batches", "action": "update", "id": existing_b["id"], "match": {"id": f"eq.{existing_b['id']}"}, "payload": b_upd, "before": existing_b, "batchCode": eff_batch_code, "section": eff_section, "homeRoom": home_room_raw})

                # 6) Student Enrollment (when both course and batch are on the row)
                stu_id_for_enr: Optional[str] = None
                if reg_no:
                    stu_obj = ctx["student_by_reg"].get(reg_no)
                    if not stu_obj:
                        add_err("studentRegistrationNumber", "invalid_fk", f"Student registration '{reg_no}' does not exist in students directory.", "Add the student first or leave registration_number empty for whole-batch/section enrollment.")
                    else:
                        stu_id_for_enr = stu_obj["id"]

                if active_course_id and active_batch_id and not errors:
                    enr_key = (active_course_id, active_batch_id, eff_section, stu_id_for_enr or "")
                    if enr_key not in staged_enrollment_keys:
                        staged_enrollment_keys.add(enr_key)
                        enr_id = str(uuid.uuid4())
                        enr_pay = {
                            "id": enr_id,
                            "institution_id": institution_id,
                            "course_id": active_course_id,
                            "batch_id": active_batch_id,
                            "student_id": stu_id_for_enr,
                            "section": eff_section,
                            "enrolled_at": now_iso(),
                        }
                        sub_ops.append({"entity": "course_enrollments", "action": "create", "id": enr_id, "payload": enr_pay, "courseCode": course_code, "batchCode": cohort_code})

                # 7) Course Assignment / Scheduling Session (when course + batch AND instructor or session details are provided)
                has_session_details = any([sess_type_raw, spw_raw, dur_raw, exp_raw, req_rtype_raw])
                assign_inst_id = course_inst_id or active_inst_id or (staged_courses_by_code.get(course_code) or {}).get("assigned_instructor_id")
                assign_lab_eng_id = course_lab_eng_id or (active_inst_id if staff_role == "lab_engineer" else None) or (staged_courses_by_code.get(course_code) or {}).get("assigned_lab_engineer_id")
                if active_course_id and active_batch_id and (assign_inst_id or has_session_details) and not errors:
                    s_key = (active_course_id, active_batch_id, eff_section, sess_type.lower())
                    comp_type = "lab" if sess_type == "Lab" else ("tutorial" if sess_type == "Tutorial" else "lecture")
                    if s_key not in staged_session_keys:
                        staged_session_keys.add(s_key)
                        s_id = f"sec-{uuid.uuid4().hex[:8]}"
                        s_pay = {
                            "id": s_id,
                            "institution_id": institution_id,
                            "course_id": active_course_id,
                            "instructor_id": assign_inst_id,
                            "lab_engineer_id": assign_lab_eng_id,
                            "batch_id": active_batch_id,
                            "section_code": eff_section,
                            "session_type": sess_type,
                            "component_type": comp_type,
                            "sessions_per_week": spw_val,
                            "duration_minutes": dur_val,
                            "expected_students": exp_students_val,
                            "required_room_type": req_rtype_val,
                            "required_equipment": req_equip,
                            "created_at": now_iso(),
                        }
                        sub_ops.append({"entity": "course_sessions", "action": "create", "id": s_id, "payload": s_pay, "courseId": active_course_id, "batchId": active_batch_id, "instructorId": assign_inst_id})
                    elif duplicate_mode == "update" and s_key in ctx["session_by_key"] and has_session_details:
                        existing_s = ctx["session_by_key"][s_key]
                        s_upd = {
                            "instructor_id": assign_inst_id or existing_s.get("instructor_id"),
                            "lab_engineer_id": assign_lab_eng_id or existing_s.get("lab_engineer_id"),
                            "sessions_per_week": spw_val if spw_raw else existing_s.get("sessions_per_week", spw_val),
                            "duration_minutes": dur_val if dur_raw else existing_s.get("duration_minutes", dur_val),
                            "expected_students": exp_students_val if exp_raw else existing_s.get("expected_students", exp_students_val),
                            "required_room_type": req_rtype_val if req_rtype_raw else existing_s.get("required_room_type", req_rtype_val),
                            "component_type": comp_type,
                        }
                        diffs = _compute_diffs(existing_s, s_upd, [("instructor_id", "Instructor ID"), ("sessions_per_week", "Sessions / Week"), ("duration_minutes", "Duration (min)"), ("expected_students", "Expected Students"), ("required_room_type", "Room Type")])
                        if diffs:
                            field_diffs.append({"row": row_num, "identifier": f"{course_code} ({cohort_code}-{eff_section})", "entity": "Course Assignment", "diffs": diffs})
                            sub_ops.append({"entity": "course_sessions", "action": "update", "id": existing_s["id"], "match": {"id": f"eq.{existing_s['id']}"}, "payload": s_upd, "before": existing_s, "courseId": active_course_id, "batchId": active_batch_id, "instructorId": assign_inst_id})

                if not errors:
                    if sub_ops:
                        has_create = any(op["action"] == "create" for op in sub_ops)
                        has_update = any(op["action"] == "update" for op in sub_ops)
                        bundle_action = "update" if (has_update and not has_create) else "create"
                        action = "update" if has_update and not has_create else "create"
                        row_op = {"entity": "all_bundle", "action": bundle_action, "subOps": sub_ops}
                    else:
                        duplicate_cnt += 1
                        if duplicate_mode == "stop":
                            add_err("courseCode", "duplicate", "All entities on this master row already exist.", "Remove duplicate row or select Skip/Update duplicate mode.")
                        else:
                            action = "skip"
                            add_warn("courseCode", "All entities on this row already exist; row skipped.")
            stable_id = course_code or room_code or cohort_code or inst_email or dept_code or f"row-{row_num}"

        # Determine final row status
        if errors:
            row_status = "error"
            action = "failed"
            error_cnt += 1
        elif action == "skip":
            row_status = "duplicate_skip"
            skip_cnt += 1
            if warnings:
                warning_cnt += 1
        elif action == "update":
            row_status = "duplicate_update"
            update_cnt += 1
            if warnings:
                warning_cnt += 1
        else:
            row_status = "warning" if warnings else "ready"
            create_cnt += 1
            if warnings:
                warning_cnt += 1

        if row_op and not errors and action != "skip":
            row_op["rowNumber"] = row_num
            planned_ops.append(row_op)

        row_results.append({
            "rowNumber": row_num,
            "identifier": stable_id,
            "status": row_status,
            "action": action,
            "originalData": original_row,
            "mappedData": mapped_vals,
            "errors": errors,
            "warnings": warnings,
        })

    # Can proceed?
    # - In 'stop' mode, ANY duplicate or error blocks import completely before writes
    # - In 'skip' or 'update' mode, allow proceeding if >= 1 valid operation OR return atomic block if caller requires 0 errors
    can_proceed = error_cnt == 0 if duplicate_mode == "stop" else True
    blocking_reason = None
    if duplicate_mode == "stop" and error_cnt > 0:
        blocking_reason = f"{error_cnt} row(s) have blocking errors or duplicates under 'Stop & Resolve' mode."
    elif (create_cnt + update_cnt) == 0 and error_cnt > 0:
        can_proceed = False
        blocking_reason = "No valid rows to import because all rows failed validation."

    return {
        "category": category,
        "duplicateMode": duplicate_mode,
        "headers": parsed_headers,
        "mappingInfo": mapping_info,
        "canProceed": can_proceed,
        "blockingReason": blocking_reason,
        "summary": {
            "totalRows": len(parsed_rows),
            "validRows": create_cnt + update_cnt,
            "warningRows": warning_cnt,
            "errorRows": error_cnt,
            "duplicateRows": duplicate_cnt,
            "createCount": create_cnt,
            "updateCount": update_cnt,
            "skipCount": skip_cnt,
            "missingRequiredCount": missing_req_cnt,
            "invalidTypeCount": invalid_type_cnt,
            "invalidFkCount": invalid_fk_cnt,
        },
        "rows": row_results,
        "fieldDiffs": field_diffs,
        "plannedOperations": planned_ops,
    }


# ---------------------------------------------------------------------------
# Error Report CSV Builder (Preserves Original CSV Headers!)
# ---------------------------------------------------------------------------

def build_error_report_csv(headers: List[str], row_results: List[Dict[str, Any]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["row_number", "status", "error_columns", "problem", "suggested_correction", *headers])
    for row in row_results:
        errs = row.get("errors") or []
        if not errs and row.get("status") != "error":
            continue
        err_cols = "; ".join(dict.fromkeys(e.get("column", "") for e in errs if e.get("column")))
        problems = " | ".join(e.get("message", "") for e in errs)
        suggestions = " | ".join(dict.fromkeys(e.get("suggestion", "") for e in errs if e.get("suggestion")))
        orig = row.get("originalData") or {}
        writer.writerow([
            row.get("rowNumber", ""),
            row.get("status", "error"),
            err_cols,
            problems,
            suggestions,
            *[orig.get(h, "") for h in headers],
        ])
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Staged Execution with Batch Chunking, Compensating Rollback & Idempotency
# ---------------------------------------------------------------------------

def _rollback_journal(client: Any, journal: Dict[str, Any]) -> None:
    """Best-effort compensating rollback of every row created or updated during a failed import."""
    for table, row_id in reversed(journal.get("inserted", [])):
        try:
            client.delete(table, {"id": f"eq.{row_id}"})
        except Exception:
            pass
    for table, match_filter, old_row in reversed(journal.get("updated", [])):
        try:
            restore_payload = {k: v for k, v in old_row.items() if k != "id"}
            client.update(table, match_filter, restore_payload)
        except Exception:
            pass


def _sync_equipment_rows(
    client: Any,
    institution_id: str,
    room_id: str,
    room_kind: str,
    equipment: List[str],
) -> None:
    if not equipment:
        return
    try:
        client.delete("room_equipment_capacities", {"institution_id": f"eq.{institution_id}", "room_id": f"eq.{room_id}"})
        client.insert(
            "room_equipment_capacities",
            [
                {
                    "institution_id": institution_id,
                    "room_id": room_id,
                    "room_kind": room_kind,
                    "equipment_name": item,
                    "quantity": 1,
                    "has_projector": "projector" in item.lower(),
                    "has_smartboard": "smartboard" in item.lower(),
                    "has_high_performance_pcs": any(k in item.lower() for k in ("workstation", "cluster", "gpu")),
                }
                for item in equipment
            ],
        )
    except SupabaseQueryError:
        pass


def _strip_optional_columns_and_insert(client: Any, table: str, rows: List[Dict[str, Any]]) -> None:
    """Inserts a batch of rows into Supabase table, falling back gracefully if optional migration columns aren't present."""
    if not rows:
        return
    try:
        client.insert(table, rows)
    except SupabaseQueryError as err:
        msg = (err.message or "").lower()
        if table == "courses" and ("course_type" in msg or "lecture_credit_hours" in msg or "sub_department" in msg):
            core_keys = ("id", "institution_id", "department_id", "code", "title", "credit_hours", "lecture_hours_per_week", "lab_hours_per_week", "is_compulsory", "required_equipment", "created_at")
            client.insert(table, [{k: r[k] for k in core_keys if k in r} for r in rows])
        elif table == "laboratories" and "assigned_lab_engineer_id" in msg:
            client.insert(table, [{k: v for k, v in r.items() if k != "assigned_lab_engineer_id"} for r in rows])
        elif table == "course_sessions" and ("lab_engineer_id" in msg or "component_type" in msg):
            client.insert(table, [{k: v for k, v in r.items() if k not in ("lab_engineer_id", "component_type")} for r in rows])
        else:
            raise


def commit_staged_import(
    client: Any,
    auth_user: Dict[str, Any],
    institution_id: str,
    category: str,
    file_name: str,
    duplicate_mode: str = "skip",
    confirm_updates: bool = False,
    atomic: bool = False,
    idempotency_key: Optional[str] = None,
    csv_text: Optional[str] = None,
    headers: Optional[List[str]] = None,
    rows: Optional[List[List[str]]] = None,
    column_mappings: Optional[Dict[str, str]] = None,
    on_before_chunk_write: Optional[Callable[[str, int], None]] = None,
) -> Dict[str, Any]:
    started_ms = time.perf_counter()

    # Check idempotency key FIRST to guarantee repeated submissions do not double-insert
    effective_key = (idempotency_key or "").strip()
    if not effective_key and csv_text is not None:
        raw_sig = f"{institution_id}:{category}:{duplicate_mode}:{file_name}:{csv_text}"
        effective_key = hashlib.sha256(raw_sig.encode("utf-8")).hexdigest()[:32]
    elif not effective_key:
        effective_key = f"imp-{uuid.uuid4().hex[:12]}"

    try:
        existing_run = client.select_one(
            "import_history",
            filters={"institution_id": f"eq.{institution_id}", "idempotency_key": f"eq.{effective_key}"},
        )
        if existing_run and existing_run.get("response_snapshot"):
            snap = dict(existing_run["response_snapshot"])
            snap["idempotentReplay"] = True
            return snap
    except SupabaseQueryError:
        pass

    # Server-side re-validation (never trust client preview blindly)
    validation = validate_and_stage_import(
        client=client,
        institution_id=institution_id,
        category=category,
        duplicate_mode=duplicate_mode,
        csv_text=csv_text,
        headers=headers,
        rows=rows,
        column_mappings=column_mappings,
    )

    summary = validation["summary"]
    error_csv = build_error_report_csv(validation["headers"], validation["rows"])

    # Enforce strict blocking rules
    if not validation["canProceed"]:
        return {
            "success": False,
            "blocked": True,
            "status": "failed",
            "message": validation["blockingReason"] or "Validation failed before commit.",
            "validation": validation,
            "errorCsv": error_csv,
            "counts": {
                "totalRows": summary["totalRows"],
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "failed": summary["errorRows"],
            },
        }

    if atomic and summary["errorRows"] > 0:
        return {
            "success": False,
            "blocked": True,
            "status": "failed",
            "message": f"Atomic import aborted: {summary['errorRows']} row(s) failed server-side validation. Zero records were written.",
            "validation": validation,
            "errorCsv": error_csv,
            "counts": {
                "totalRows": summary["totalRows"],
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "failed": summary["errorRows"],
            },
        }

    if duplicate_mode == "update" and summary["updateCount"] > 0 and not confirm_updates:
        return {
            "success": False,
            "blocked": True,
            "requiresConfirmation": True,
            "status": "failed",
            "message": f"Explicit confirmation required before overwriting {summary['updateCount']} matching record(s).",
            "validation": validation,
            "errorCsv": error_csv,
            "counts": {
                "totalRows": summary["totalRows"],
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "failed": summary["errorRows"],
            },
        }

    planned_ops = validation["plannedOperations"]
    journal: Dict[str, Any] = {"inserted": [], "updated": []}

    # Expand 'all_bundle' subOps into flat atomic operations in dependency order
    flat_ops: List[Dict[str, Any]] = []
    for op in planned_ops:
        if op.get("entity") == "all_bundle":
            flat_ops.extend(op.get("subOps") or [])
        else:
            flat_ops.append(op)

    created_count = 0
    updated_count = 0
    skipped_count = summary["skipCount"]
    failed_count = summary["errorRows"]

    entity_order = ("departments", "instructors", "classrooms", "laboratories", "courses", "batches", "course_enrollments", "course_sessions")
    grouped_creates: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    update_ops: List[Dict[str, Any]] = []

    for op in flat_ops:
        if op["action"] == "create":
            grouped_creates[op["entity"]].append(op)
        elif op["action"] == "update":
            update_ops.append(op)

    try:
        # 1. Execute chunked inserts per table in strict FK dependency order
        for tbl in entity_order:
            ops_for_tbl = grouped_creates.get(tbl, [])
            for start in range(0, len(ops_for_tbl), BATCH_CHUNK_SIZE):
                chunk = ops_for_tbl[start : start + BATCH_CHUNK_SIZE]
                if on_before_chunk_write:
                    on_before_chunk_write(tbl, start)
                payloads = [o["payload"] for o in chunk]
                _strip_optional_columns_and_insert(client, tbl, payloads)
                for o in chunk:
                    journal["inserted"].append((tbl, o["id"]))
                    if tbl in ("classrooms", "laboratories") and o.get("equipment"):
                        _sync_equipment_rows(
                            client,
                            institution_id,
                            o["id"],
                            "laboratory" if tbl == "laboratories" else "classroom",
                            o["equipment"],
                        )
                created_count += len(chunk)

        # 2. Execute updates individually while recording pre-update snapshots for rollback
        for op in update_ops:
            tbl = op["entity"]
            if on_before_chunk_write:
                on_before_chunk_write(tbl, -1)
            client.update(tbl, op["match"], op["payload"])
            journal["updated"].append((tbl, op["match"], op["before"]))
            if tbl in ("classrooms", "laboratories") and op.get("equipment"):
                _sync_equipment_rows(
                    client,
                    institution_id,
                    op["id"],
                    "laboratory" if tbl == "laboratories" else "classroom",
                    op["equipment"],
                )
            updated_count += 1

    except Exception as exc:
        _rollback_journal(client, journal)
        duration_ms = int((time.perf_counter() - started_ms) * 1000)
        try:
            client.insert(
                "import_history",
                {
                    "id": f"imp-{uuid.uuid4().hex[:10]}",
                    "institution_id": institution_id,
                    "user_id": auth_user.get("userId"),
                    "user_name": auth_user.get("name") or "Administrator",
                    "user_email": auth_user.get("email") or "",
                    "category": category,
                    "file_name": file_name or "upload.csv",
                    "duplicate_mode": duplicate_mode,
                    "status": "rolled_back",
                    "idempotency_key": f"rollback-{uuid.uuid4().hex[:12]}",
                    "total_rows": summary["totalRows"],
                    "created_count": 0,
                    "updated_count": 0,
                    "skipped_count": 0,
                    "failed_count": summary["totalRows"],
                    "duration_ms": duration_ms,
                    "error_summary": [{"message": f"Database error triggered atomic rollback: {str(exc)}"}],
                    "created_at": now_iso(),
                },
            )
        except Exception:
            pass
        raise RuntimeError(f"Import failed mid-batch and was safely rolled back (zero partial records kept): {exc}") from exc

    duration_ms = int((time.perf_counter() - started_ms) * 1000)
    status_val = "partial" if failed_count > 0 else "completed"
    import_id = f"imp-{uuid.uuid4().hex[:10]}"

    error_summary = [
        {
            "rowNumber": r["rowNumber"],
            "identifier": r["identifier"],
            "errors": r["errors"],
        }
        for r in validation["rows"]
        if r["status"] == "error"
    ][:200]

    response_payload: Dict[str, Any] = {
        "success": True,
        "idempotentReplay": False,
        "importId": import_id,
        "status": status_val,
        "category": category,
        "fileName": file_name or "upload.csv",
        "duplicateMode": duplicate_mode,
        "durationMs": duration_ms,
        "counts": {
            "totalRows": summary["totalRows"],
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "failed": failed_count,
        },
        "message": (
            f"Import {status_val}: {created_count} created, {updated_count} updated, "
            f"{skipped_count} skipped, {failed_count} rejected in {duration_ms}ms."
        ),
        "errorCsv": error_csv if failed_count > 0 else "",
        "errorSummary": error_summary,
        "appliedOperations": [
            {
                "entity": op["entity"],
                "action": op["action"],
                "id": op["id"],
                "payload": op["payload"],
                **{k: v for k, v in op.items() if k not in ("before", "match", "entity", "action", "id", "payload")},
            }
            for op in flat_ops
        ],
    }

    try:
        client.insert(
            "import_history",
            {
                "id": import_id,
                "institution_id": institution_id,
                "user_id": auth_user.get("userId"),
                "user_name": auth_user.get("name") or "Administrator",
                "user_email": auth_user.get("email") or "",
                "category": category,
                "file_name": file_name or "upload.csv",
                "duplicate_mode": duplicate_mode,
                "status": status_val,
                "idempotency_key": effective_key,
                "total_rows": summary["totalRows"],
                "created_count": created_count,
                "updated_count": updated_count,
                "skipped_count": skipped_count,
                "failed_count": failed_count,
                "duration_ms": duration_ms,
                "error_summary": error_summary,
                "response_snapshot": response_payload,
                "created_at": now_iso(),
            },
        )
    except SupabaseQueryError:
        # Table may not be migrated yet in older Supabase instances; never fail committed academic rows if logging table is absent
        pass

    return response_payload
