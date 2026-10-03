'use client';
import { X, Star } from 'lucide-react';
export const Avatar = ({ name = '?', color = 'var(--accent)', size = 32, src }) => src
  ? <img className="av" src={src} alt="" style={{ width: size, height: size, objectFit: 'cover' }} />
  : <span className="av" style={{ background: color, width: size, height: size, fontSize: size / 2.3 }}>{(name || '?')[0].toUpperCase()}</span>;
export const Stars = ({ value = 0, onChange }) => (
  <span className="stars">{[1, 2, 3, 4, 5].map(n => (
    <button key={n} type="button" className="star" disabled={!onChange} onClick={() => onChange?.(n)}>
      <Star size={onChange ? 32 : 15} fill={n <= Math.round(value) ? 'currentColor' : 'none'} /></button>))}</span>);
export const Sheet = ({ title, onClose, children }) => (
  <div className="ov" onClick={onClose}><div className="sheet" onClick={e => e.stopPropagation()}>
    <div className="sh"><b>{title}</b><button className="ib" onClick={onClose}><X size={22} /></button></div>{children}</div></div>);
export const Pill = ({ s }) => <span className={`pill ${s}`}>{s === 'not_started' ? 'planned' : s.replace('_', ' ')}</span>;
export const Empty = ({ icon, text }) => <div className="empty">{icon}<p>{text}</p></div>;
export const Field = ({ label, ...p }) => <label className="fld"><span>{label}</span><input {...p} /></label>;
