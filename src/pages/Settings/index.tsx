import React, { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';

type Profile = { id: string; name: string; email: string; username: string };
type Operator = { id: string; name: string; email: string; username: string; canGenerateLandings: boolean; canViewOrders: boolean; canManageAll: boolean };

export default function Settings() {
  const [tab, setTab] = useState<'perfil'|'operadores'>('perfil');
  return (
    <div>
      <h2 style={{marginTop:0}}>Configurações</h2>
      <div style={{display:'flex', gap:12, marginBottom:16}}>
        <button onClick={()=>setTab('perfil')} style={{padding:'8px 12px', borderRadius:8, border:'1px solid #ccc', background: tab==='perfil'?'#175544':'#fff', color: tab==='perfil'?'#fff':'#000'}}>Perfil</button>
        <button onClick={()=>setTab('operadores')} style={{padding:'8px 12px', borderRadius:8, border:'1px solid #ccc', background: tab==='operadores'?'#175544':'#fff', color: tab==='operadores'?'#fff':'#000'}}>Operadores de Conta</button>
      </div>
      {tab==='perfil' ? <ProfileSettings/> : <OperatorsSettings/>}
    </div>
  );
}

function ProfileSettings() {
  const [data, setData] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);

  useEffect(()=>{
    apiClient.get('/settings/profile')
      .then(({data:p})=>{ setData(p); setName(p.name||''); setEmail(p.email||''); setUsername(p.username||''); })
      .catch((e)=>{ setErr(e.response?.data?.message || e.message || 'Falha ao carregar perfil'); });
  },[]);

  async function save() {
    setSaving(true); setErr(null); setMsg(null);
    try {
      await apiClient.put('/settings/profile', { name, email, username, password: password || undefined });
      setMsg('Perfil atualizado com sucesso'); setPassword('');
    } catch (e:any) { setErr(e.response?.data?.message || e.message || 'Erro'); } finally { setSaving(false); }
  }

  return (
    <div style={{background:'#fff', border:'1px solid #e8e8e8', borderRadius:12, padding:16, maxWidth:720}}>
      <h3>Perfil</h3>
      {msg && <div style={{color:'#175544'}}>{msg}</div>}
      {err && <div style={{color:'#b00020'}}>{err}</div>}
      <div style={{display:'grid', gap:12}}>
        <label>Nome<input value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/></label>
        <label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} type="email"/></label>
        <label>Login (username)<input value={username} onChange={e=>setUsername(e.target.value)} style={inputStyle}/></label>
        <label>Nova senha (opcional)<input value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle} type="password"/></label>
        <div><button onClick={save} disabled={saving} style={primaryBtn}>{saving?'Salvando...':'Salvar'}</button></div>
      </div>
    </div>
  );
}

function OperatorsSettings() {
  const [list, setList] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  const [form, setForm] = useState({ name:'', email:'', username:'', password:'', canGenerateLandings:true, canViewOrders:true, canManageAll:false });
  const [saving, setSaving] = useState(false);

  const load = ()=>{
    setLoading(true); setErr(null);
    apiClient.get('/settings/operators')
      .then(({data})=> setList(data))
      .catch((e)=> setErr(e.response?.data?.message || e.message || 'Falha ao carregar operadores'))
      .finally(()=> setLoading(false));
  };

  useEffect(load, []);

  async function create() {
    setSaving(true); setErr(null);
    try {
      await apiClient.post('/settings/operators', form);
      setForm({ name:'', email:'', username:'', password:'', canGenerateLandings:true, canViewOrders:true, canManageAll:false });
      load();
    } catch (e:any) { setErr(e.response?.data?.message || e.message || 'Erro'); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Excluir operador?')) return;
    await apiClient.delete(`/settings/operators/${id}`);
    load();
  }

  return (
    <div style={{display:'grid', gap:16}}>
      <div style={{background:'#fff', border:'1px solid #e8e8e8', borderRadius:12, padding:16}}>
        <h3>Novo Operador</h3>
        {err && <div style={{color:'#b00020'}}>{err}</div>}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <input placeholder="Nome" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inputStyle}/>
          <input placeholder="E-mail" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={inputStyle}/>
          <input placeholder="Usuário" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} style={inputStyle}/>
          <input placeholder="Senha" type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={inputStyle}/>
          <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.canGenerateLandings} onChange={e=>setForm(f=>({...f,canGenerateLandings:e.target.checked}))}/> Gerar Landing Pages</label>
          <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.canViewOrders} onChange={e=>setForm(f=>({...f,canViewOrders:e.target.checked}))}/> Visualizar Pedidos</label>
          <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.canManageAll} onChange={e=>setForm(f=>({...f,canManageAll:e.target.checked}))}/> Acesso completo</label>
        </div>
        <div style={{marginTop:12}}><button onClick={create} disabled={saving} style={primaryBtn}>{saving?'Salvando...':'Adicionar Operador'}</button></div>
      </div>

      <div style={{background:'#fff', border:'1px solid #e8e8e8', borderRadius:12, padding:16}}>
        <h3>Operadores</h3>
        {loading ? 'Carregando...' : (
          <table style={{width:'100%'}}>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Usuário</th><th>Permissões</th><th></th></tr></thead>
            <tbody>
              {list.map(op => (
                <tr key={op.id}>
                  <td>{op.name}</td><td>{op.email}</td><td>{op.username}</td>
                  <td>
                    {op.canManageAll ? 'Completo' : [op.canGenerateLandings && 'Landing', op.canViewOrders && 'Pedidos'].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td><button onClick={()=>remove(op.id)} style={{background:'#fee2e2', color:'#b91c1c', border:'1px solid #fecaca', padding:'4px 8px', borderRadius:6}}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { border:'1px solid #ddd', borderRadius:8, padding:'8px 10px', width:'100%' };
const primaryBtn: React.CSSProperties = { background:'#175544', color:'#fff', padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer' };
