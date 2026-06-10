import React, { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import type { AdminPage } from './AdminLayout';
import { Plus, Edit2, Trash2, Users, X, Save } from 'lucide-react';

type User = { name: string; email: string; role: string };

export default function AdminUsers({ current, onNavigate, onLogout }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<User>({ name: '', email: '', role: 'user' });

  function openCreate() { setEditing(null); setForm({ name: '', email: '', role: 'user' }); setModalOpen(true); }
  function openEdit(i: number) { setEditing(i); setForm(users[i]); setModalOpen(true); }
  function remove(i: number) { setUsers(users.filter((_, idx) => idx !== i)); }
  function save() {
    if (!form.name || !form.email) return;
    if (editing === null) setUsers([...users, form]);
    else setUsers(users.map((u, i) => i === editing ? form : u));
    setModalOpen(false);
  }

  return (
    <AdminLayout current={current} onNavigate={onNavigate} onLogout={onLogout}>
      <div className="admin-page">
        <div className="admin-header"><div><h1 className="admin-title">Users</h1><p className="admin-subtitle">Kelola pengguna sistem</p></div><button className="admin-btn primary" onClick={openCreate}><Plus size={18}/>Tambah User</button></div>
        <div className="admin-card">
          {users.length===0?<div className="admin-empty"><Users size={48}/><p>Belum ada user</p><button className="admin-btn primary" onClick={openCreate}><Plus size={18}/>Buat User Pertama</button></div>:
          <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Aksi</th></tr></thead><tbody>{users.map((u,i)=><tr key={i}><td>{u.name}</td><td>{u.email}</td><td><span className="badge">{u.role}</span></td><td><button className="icon-btn" onClick={()=>openEdit(i)}><Edit2 size={16}/></button><button className="icon-btn danger" onClick={()=>remove(i)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}
        </div>
        {modalOpen&&<div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><h2>{editing===null?'Tambah User':'Edit User'}</h2><button className="icon-btn" onClick={()=>setModalOpen(false)}><X size={18}/></button></div><div className="admin-form"><div className="form-group"><label>Nama</label><input className="admin-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div className="form-group"><label>Email</label><input className="admin-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div className="form-group"><label>Role</label><select className="admin-input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="user">User</option><option value="admin">Admin</option></select></div><button className="admin-btn primary" onClick={save}><Save size={18}/>Simpan</button></div></div></div>}
      </div>
    </AdminLayout>
  );
}
