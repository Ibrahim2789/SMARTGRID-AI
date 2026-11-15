import React, { useState } from 'react';
import {
  User,
  Mail,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Hash,
  Users
} from 'lucide-react';
import { AuthenticatedVotingUser, updateOwnProfile } from '../services/votingApi';
import { showAppPopup } from './ToastPopupHost';

interface AccountProfilePageProps {
  currentUser: AuthenticatedVotingUser;
  onUserUpdated: (user: AuthenticatedVotingUser) => void;
  onSignOut: () => void;
}

export const AccountProfilePage: React.FC<AccountProfilePageProps> = ({
  currentUser,
  onUserUpdated,
  onSignOut
}) => {
  const [name, setName] = useState(currentUser.name);
  const [section, setSection] = useState(currentUser.section || 'Section A');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const roleLower = (currentUser.systemRole || currentUser.role || '').toLowerCase();
  const isStudent = roleLower === 'student';
  const isBr = roleLower === 'br';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword && newPassword !== confirmPassword) {
      const msg = 'New password and confirmation password do not match.';
      setFeedback({ type: 'error', text: msg });
      showAppPopup({ title: 'Password Mismatch', message: msg, variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      const res = await updateOwnProfile(currentUser, {
        name: name.trim(),
        section: isStudent ? section : undefined,
        newPassword: newPassword.trim() || undefined
      });
      onUserUpdated(res.user);
      setNewPassword('');
      setConfirmPassword('');
      setFeedback(null);
      showAppPopup({
        title: 'Profile Updated',
        message: res.message,
        variant: 'success'
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update profile.';
      setFeedback({ type: 'error', text: msg });
      showAppPopup({ title: 'Update Failed', message: msg, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E4E2DA]">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#77766F]">
            {currentUser.institution || 'Western Polytechnic'}
          </div>
          <h1 className="font-serif-editorial text-3xl text-[#171717] tracking-tight">
            Account &amp; Profile Settings
          </h1>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="btn-secondary text-xs h-9 px-3.5 shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-[#E8F8E0] border-[#A5E087] text-[#1B5E20]'
              : 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Read-Only Verified Role & Cohort Credentials */}
      <div className="bg-white border border-[#E4E2DA] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E2DA]">
          <h2 className="font-serif-editorial text-xl text-[#171717]">
            Verified Institutional Assignment
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA] text-xs">
          <div className="px-6 py-4 space-y-1">
            <div className="text-[#77766F] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Role</span>
            </div>
            <div className="text-sm font-semibold text-[#171717]">
              {isBr
                ? `Batch Representative (${
                    currentUser.brGenderRole === 'female' ? 'Female BR' : 'Male BR'
                  })`
                : currentUser.role}
            </div>
          </div>

          <div className="px-6 py-4 space-y-1">
            <div className="text-[#77766F] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Institutional Email</span>
            </div>
            <div className="text-sm font-semibold text-[#171717] font-mono-tabular">
              {currentUser.email}
            </div>
          </div>
        </div>

        {(isStudent || isBr) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-[#E4E2DA] divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA] text-xs">
            <div className="px-6 py-4 space-y-1">
              <div className="text-[#77766F] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Assigned Batch Cohort</span>
              </div>
              <div className="text-sm font-semibold text-[#171717]">
                {currentUser.batchCode
                  ? `${currentUser.batchCode} — ${currentUser.batchName}`
                  : 'Assigned Cohort'}
              </div>
            </div>

            <div className="px-6 py-4 space-y-1">
              <div className="text-[#77766F] flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>Registration / Roll Number</span>
              </div>
              <div className="text-sm font-semibold text-[#171717] font-mono-tabular">
                {currentUser.registrationNumber || 'Verified Record'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Editable Profile & Password Form */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-[#E4E2DA] rounded-2xl p-6 space-y-5"
      >
        <h2 className="font-serif-editorial text-xl text-[#171717] border-b border-[#E4E2DA] pb-3">
          Update Profile &amp; Password
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Full Name
            </label>
            <div className="input-group-field h-10 px-3 gap-2">
              <User className="w-4 h-4 text-[#77766F]" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {isStudent && (
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Class Section
              </label>
              <select
                value={section}
                onChange={e => setSection(e.target.value)}
                className="input-field h-10 text-xs"
              >
                <option value="Section A">Section A</option>
                <option value="Section B">Section B</option>
                <option value="Section C">Section C</option>
                <option value="Section D">Section D</option>
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              New Password (Optional)
            </label>
            <div className="input-group-field h-10 px-3 gap-2">
              <Lock className="w-4 h-4 text-[#77766F]" />
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="text-xs font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Confirm New Password
            </label>
            <div className="input-group-field h-10 px-3 gap-2">
              <Lock className="w-4 h-4 text-[#77766F]" />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="text-xs font-mono-tabular"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-[#E4E2DA]">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-2.5 px-6 text-xs font-semibold"
          >
            <span>{saving ? 'Saving...' : 'Save Account Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
