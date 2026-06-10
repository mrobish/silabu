import React, { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import type { AdminPage } from './AdminLayout';
import { Plus, Edit2, Trash2, Building2, X, Save } from 'lucide-react';

type Tenant = { name: string; email: string; status: string };

export default function AdminTenants({ current, onNavigate, onLogout }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
}) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Tenant>({ name: '', email: '', status: 'Active' });

  function openCreate() { setEditing(null); setForm({ name: '', email: '', status: 'Active' }); setModalOpen(true); }
  function openEdit(i: number) { setEditing(i); setForm(tenants[i]); setModalOpen(true); }
  function remove(i: number) { setTenants(tenants.filter((_, idx) => idx !== i)); }
  function save() {
    if (!form.name || !form.email) return;
    if (editing === null) setTenants([...tenants, form]);
    else setTenants(tenants.map((t, i) => i === editing ? form : t));
    setModalOpen(false);
  }

  return (
    <AdminLayout current={current} onNavigate={onNavigate} onLogout={onLogout}>
      <div className="admin-page">
        <div className="admin-header"><div><h1 className="admin-title">Tenants</h1><p className="admin-subtitle">Kelola data BUM Desa tenant</p></div><button className="admin-btn primary" onClick={openCreate}><Plus size={18}/>Tambah Tenant</button></div>
        <div className="admin-card">
          {tenants.length===0?<div className="admin-empty"><Building2 size={48}/><p>Belum ada tenant</p><button className="admin-btn primary" onClick={openCreate}><Plus size={18}/>Buat Tenant Pertama</button></div>:
          <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Nama</th><th>Email</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{tenants.map((t,i)=><tr key={i}><td>{t.name}</td><td>{t.email}</td><td><span className="badge success">{t.status}</span></td><td><button className="icon-btn" onClick={()=>openEdit(i)}><Edit2 size={16}/></button><button className="icon-btn danger" onClick={()=>remove(i)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}
        </div>
        {modalOpen&&<div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><h2>{editing===null?'Tambah Tenant':'Edit Tenant'}</h2><button className="icon-btn" onClick={()=>setModalOpen(false)}><X size={18}/></button></div><div className="admin-form"><div className="form-group"><label>Nama BUM Desa</label><input className="admin-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div className="form-group"><label>Email</label><input className="admin-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div className="form-group"><label>Status</label><select className="admin-input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Active</option><option>Inactive</option></select></div><button className="admin-btn primary" onClick={save}><Save size={18}/>Simpan</button></div></div></div>}
      </div>
    </AdminLayout>
  );
}
