import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Input } from '@/components/ui';
import { Users, UserPlus, Trash2, MapPin, Clock, History, Shield, Edit3, X, ExternalLink, Settings, Camera, Key } from 'lucide-react';

interface InternalModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const InternalModal: React.FC<InternalModalProps> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all max-h-[90vh] flex flex-col border border-stone-200 z-50">
        <div className="flex items-center justify-between p-4 border-b border-stone-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-grow space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [batchHistory, setBatchHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [bakerySettings, setBakerySettings] = useState({ id: 1, bakery_name: '', latitude: 6.6828, longitude: 80.3991, radius_meters: 200 });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: '', username: '', password: '', gender: 'Male', daily_salary: '', phone: '', role: 'Baker',
    nic: '', address: '', bank_details: '', emergency_contact: '', photo_url: ''
  });

  const [editForm, setEditForm] = useState({
    id: null, full_name: '', username: '', password: '', gender: 'Male', daily_salary: '', phone: '', role: 'Baker',
    nic: '', address: '', bank_details: '', emergency_contact: '', photo_url: ''
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (isEdit) setEditForm(prev => ({ ...prev, photo_url: dataUrl }));
        else setForm(prev => ({ ...prev, photo_url: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, attRes, batchRes, settingsRes] = await Promise.all([
        supabase.from('bakery_employees').select('*').order('id', { ascending: false }),
        supabase.from('bakery_attendance').select('*').eq('attendance_date', new Date().toISOString().split('T')[0]),
        supabase.from('bakery_batch_cards').select('*').order('id', { ascending: false }),
        supabase.from('bakery_settings').select('*').eq('id', 1).maybeSingle()
      ]);
      setEmployees(empRes.data || []);
      setAttendance(attRes.data || []);
      setBatchHistory(batchRes.data || []);
      if (settingsRes.data) {
        setBakerySettings(settingsRes.data);
      }
    } catch (err) { console.error('දත්ත ලබාගැනීමේ දෝෂයකි:', err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveBakerySettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('bakery_settings').upsert({
        id: 1,
        bakery_name: bakerySettings.bakery_name || 'Bakery',
        latitude: parseFloat(String(bakerySettings.latitude)) || 6.6828,
        longitude: parseFloat(String(bakerySettings.longitude)) || 80.3991,
        radius_meters: parseInt(String(bakerySettings.radius_meters)) || 200,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;
      alert('බේකරියේ GPS ඛණ්ඩාංක සහ සීමාව සාර්ථකව සුරකින ලදී!');
      setSettingsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
    setSavingSettings(false);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleCheckIn = async (employeeId: number) => {
    if (!navigator.geolocation) { alert('ඔබගේ ජංගම දුරකථනයේ GPS පහසුකම් ක්‍රියාත්මක නැත.'); return; }

    const BAKERY_LAT = Number(bakerySettings.latitude) || 6.6828;
    const BAKERY_LNG = Number(bakerySettings.longitude) || 80.3991;
    const ALLOWED_RADIUS = Number(bakerySettings.radius_meters) || 200;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = calculateDistance(BAKERY_LAT, BAKERY_LNG, userLat, userLng);

        if (distance > ALLOWED_RADIUS) {
          alert(`පැමිණීම අසාර්ථකයි! ඔබ බේකරියෙන් බැහැරව සිටී. දුර ප්‍රමාණය: ${Math.round(distance)}m (අවසරලත් සීමාව: ${ALLOWED_RADIUS}m)`);
          return;
        }

        const checkInLocationLink = `https://www.google.com/maps?q=${userLat},${userLng}`;

        try {
          const { error } = await supabase.from('bakery_attendance').insert({
            employee_id: employeeId,
            attendance_date: new Date().toISOString().split('T')[0],
            check_in_time: new Date().toISOString(),
            latitude: userLat,
            longitude: userLng,
            location_link: checkInLocationLink,
            status: 'Checked In'
          });

          if (error) throw error;
          alert('පැමිණීම (Check-in) සාර්ථකයි!');
          fetchData();
        } catch (err: any) {
          alert('දෝෂයකි: ' + err.message);
        }
      },
      (error) => {
        alert('GPS පිහිටුම ලබා ගැනීමට නොහැකි විය: ' + error.message);
      }
    );
  };

  const handleCheckOut = async (attendanceId: number) => {
    try {
      const { error } = await supabase.from('bakery_attendance').update({
        check_out_time: new Date().toISOString(),
        status: 'Checked Out'
      }).eq('id', attendanceId);
      if (error) throw error; alert('වැඩ අවසන් කිරීම (Check-out) සාර්ථකයි!'); fetchData();
    } catch (err: any) { alert('දෝෂයකි: ' + err.message); }
  };

  const handleSaveEmployee = async () => {
    if (!form.full_name || !form.username || !form.password) { alert('කරුණාකර අවශ්‍ය සියලුම මූලික තොරතුරු පුරවන්න.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('bakery_employees').insert({
        full_name: form.full_name, username: form.username, password: form.password, gender: form.gender,
        daily_salary: parseFloat(form.daily_salary) || 0, phone: form.phone, role: form.role, nic: form.nic,
        address: form.address, bank_details: form.bank_details, emergency_contact: form.emergency_contact, photo_url: form.photo_url
      });
      if (error) throw error; alert('සේවකයා සාර්ථකව ලියාපදිංචි කරන ලදී!');
      setModalOpen(false); setForm({
        full_name: '', username: '', password: '', gender: 'Male', daily_salary: '', phone: '', role: 'Baker',
        nic: '', address: '', bank_details: '', emergency_contact: '', photo_url: ''
      }); fetchData();
    } catch (err: any) { alert('දෝෂයකි: ' + err.message); }
    setSubmitting(false);
  };

  const handleUpdateEmployee = async () => {
    if (!editForm.full_name || !editForm.username) { alert('කරුණාකර නම සහ පරිශීලක නම ඇතුළත් කරන්න.'); return; }
    setSubmitting(true);
    try {
      const updatePayload: any = {
        full_name: editForm.full_name, username: editForm.username, gender: editForm.gender,
        daily_salary: parseFloat(editForm.daily_salary) || 0, phone: editForm.phone, role: editForm.role,
        nic: editForm.nic, address: editForm.address, bank_details: editForm.bank_details,
        emergency_contact: editForm.emergency_contact, photo_url: editForm.photo_url
      };
      if (editForm.password) updatePayload.password = editForm.password;
      const { error } = await supabase.from('bakery_employees').update(updatePayload).eq('id', editForm.id);
      if (error) throw error; alert('සේවක තොරතුරු සාර්ථකව යාවත්කාලීන කරන ලදී!');
      setEditModalOpen(false); fetchData();
    } catch (err: any) { alert('දෝෂයකි: ' + err.message); }
    setSubmitting(false);
  };

  const openEditModal = (emp: any) => {
    setEditForm({
      id: emp.id, full_name: emp.full_name || '', username: emp.username || '', password: '',
      gender: emp.gender || 'Male', daily_salary: emp.daily_salary || '', phone: emp.phone || '',
      role: emp.role || 'Baker', nic: emp.nic || '', address: emp.address || '', bank_details: emp.bank_details || '',
      emergency_contact: emp.emergency_contact || '', photo_url: emp.photo_url || ''
    }); setEditModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('මෙම ගිණුම ඉවත් කිරීමට අවශ්‍ය බව විශ්වාසද?')) return;
    try {
      const { error } = await supabase.from('bakery_employees').delete().eq('id', id);
      if (error) throw error; fetchData();
    } catch (err: any) { alert('ඉවත් කිරීමේ දෝෂයකි: ' + err.message); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-600" /> සේවක සහ ඇඩ්මින් කළමනාකරණය (Staff & Roles)
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">සේවකයින් කළමනාකරණය, බේකරි GPS ස්ථාන සැකසුම් සහ පැමිණීම පාලනය.</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setSettingsModalOpen(true)} className="bg-stone-800 hover:bg-stone-900 text-white text-xs flex items-center gap-1.5">
            <Settings className="h-4 w-4" /> බේකරි GPS සැකසුම් (Bakery GPS)
          </Button>
          <Button onClick={() => setModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" /> නව සේවකයෙක් එක් කරන්න
          </Button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-amber-700" />
          <div>
            <p className="font-bold text-amber-900 text-sm">බේකරි පිහිටුම් සීමාව: <span className="text-stone-800">{bakerySettings.bakery_name || 'Bakery'}</span></p>
            <p className="text-stone-600 font-mono mt-0.5">Lat: {bakerySettings.latitude} | Lng: {bakerySettings.longitude} | අවසරලත් දුර: <strong className="text-amber-800">{bakerySettings.radius_meters}m</strong></p>
          </div>
        </div>
        <Button onClick={() => setSettingsModalOpen(true)} variant="secondary" className="text-xs font-bold text-amber-800 bg-white border-amber-300 hover:bg-amber-100">
          ස්ථානය වෙනස් කරන්න
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.length === 0 ? (
          <div className="col-span-full py-12 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">තවම සේවකයින් ලියාපදිංචි කර නැත.</div>
        ) : (
          employees.map(emp => {
            const todayAtt = attendance.find(a => a.employee_id === emp.id);
            const isCheckedIn = todayAtt && todayAtt.status === 'Checked In';
            const isAdmin = emp.role === 'Admin';
            return (
              <Card key={emp.id} className={`p-5 space-y-4 border-l-4 ${isAdmin ? 'border-purple-600 bg-purple-50/10' : 'border-amber-500'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-amber-500 shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center font-bold text-stone-600 text-sm">
                        {emp.full_name?.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-stone-900 text-base">{emp.full_name}</h3>
                      <p className="text-xs text-stone-400 font-mono">Username: {emp.username}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1 ${
                    isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isAdmin ? <Shield className="h-3 w-3" /> : null} {emp.role}
                  </span>
                </div>

                {/* සේවකයාගේ වත්මන් මුරපදය (Password) ඇඩ්මින්ට පෙනෙන අයුරින් */}
                <div className="bg-amber-100/60 border border-amber-300 px-3 py-2 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-amber-700" /> මුරපදය (Password):
                  </span>
                  <span className="font-mono font-extrabold text-stone-900 bg-white px-2 py-0.5 rounded shadow-sm border border-amber-200">
                    {emp.password || 'නැත'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-stone-400 text-[10px] block">හැඳුනුම්පත (NIC)</span>
                      <span className="font-mono font-bold text-stone-800">{emp.nic || 'නැත'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[10px] block">දිනක වැටුප</span>
                      <span className="font-mono font-bold text-emerald-700">Rs. {Number(emp.daily_salary || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200">
                    <div>
                      <span className="text-stone-400 text-[10px] block">දුරකථන අංකය</span>
                      <span className="font-medium text-stone-800">{emp.phone || 'නැත'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[10px] block">හදිසි ඇමතුම්</span>
                      <span className="font-medium text-stone-800">{emp.emergency_contact || 'නැත'}</span>
                    </div>
                  </div>
                  {emp.address && (
                    <div>
                      <span className="text-stone-400 text-[10px] block">ලිපිනය</span>
                      <span className="text-stone-700 truncate block">{emp.address}</span>
                    </div>
                  )}
                  {emp.bank_details && (
                    <div>
                      <span className="text-stone-400 text-[10px] block">බැංකු විස්තර</span>
                      <span className="font-mono text-stone-700">{emp.bank_details}</span>
                    </div>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-700 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-amber-600" /> GPS පැමිණීම:
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      isCheckedIn ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {todayAtt ? todayAtt.status : 'පැමිණ නැත'}
                    </span>
                  </div>

                  {todayAtt && todayAtt.location_link && (
                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 flex justify-between items-center">
                      <span className="text-[11px] font-bold text-amber-900">Check-in පිහිටුම:</span>
                      <a href={todayAtt.location_link} target="_blank" rel="noopener noreferrer" className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                        Map View <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  )}

                  {!todayAtt ? (
                    <Button onClick={() => handleCheckIn(emp.id)} className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs py-1.5 flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> පැමිණීම දමන්න (Check-In)
                    </Button>
                  ) : isCheckedIn ? (
                    <Button onClick={() => handleCheckOut(todayAtt.id)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> වැඩ අවසන් (Check-Out)
                    </Button>
                  ) : (
                    <p className="text-[10px] text-stone-400 italic text-center">අද දින වැඩ අවසන් කර ඇත</p>
                  )}
                </div>

                <div className="pt-2 border-t flex justify-between items-center gap-2">
                  <Button onClick={() => { setSelectedEmp(emp); setHistoryModalOpen(true); }} variant="secondary" className="text-[11px] flex items-center gap-1 py-1.5 px-2.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 font-bold">
                    <History className="h-3.5 w-3.5" /> ඉතිහාසය
                  </Button>

                  <div className="flex gap-1.5">
                    <Button onClick={() => openEditModal(emp)} className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] flex items-center gap-1 py-1.5 px-3 font-bold shadow-sm">
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button onClick={() => handleDelete(emp.id)} variant="secondary" className="text-red-600 hover:bg-red-50 text-[11px] flex items-center gap-1 py-1.5 px-2.5 font-bold border-red-200">
                      <Trash2 className="h-3.5 w-3.5" /> ඉවත් කරන්න
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* BAKERY GPS SETTINGS MODAL */}
      <InternalModal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} title="බේකරියේ GPS ඛණ්ඩාංක සැකසීම (Bakery GPS Settings)">
        <div className="space-y-4 text-xs">
          <p className="text-stone-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
            💡 සටහන: සේවකයින් Check-in වන විට ඔවුන් සිටින්නේ බේකරිය අසලමද යන්න පරීක්ෂා කිරීමට මෙම අගයන් භාවිතා කරයි.
          </p>
          <Input label="බේකරි නම (Bakery Name)" value={bakerySettings.bakery_name} onChange={(v) => setBakerySettings({ ...bakerySettings, bakery_name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="අක්ෂාංශ (Latitude)" type="number" step="any" value={bakerySettings.latitude} onChange={(v) => setBakerySettings({ ...bakerySettings, latitude: parseFloat(v) || 0 })} />
            <Input label="දේශාංශ (Longitude)" type="number" step="any" value={bakerySettings.longitude} onChange={(v) => setBakerySettings({ ...bakerySettings, longitude: parseFloat(v) || 0 })} />
          </div>
          <Input label="අවසරලත් සීමාව මීටර් වලින් (Radius in Meters)" type="number" value={bakerySettings.radius_meters} onChange={(v) => setBakerySettings({ ...bakerySettings, radius_meters: parseInt(v) || 200 })} />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setSettingsModalOpen(false)}>අවලංගු කරන්න</Button>
            <Button onClick={handleSaveBakerySettings} disabled={savingSettings} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
              {savingSettings ? 'සුරකිමින්...' : 'සැකසුම් සුරකින්න'}
            </Button>
          </div>
        </div>
      </InternalModal>

      {/* REGISTER MODAL */}
      <InternalModal open={modalOpen} onClose={() => setModalOpen(false)} title="නව සේවකයෙක් ලියාපදිංචි කිරීම">
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="සම්පූර්ණ නම (Full Name)*" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Input label="පරිශීලක නම (Username)*" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="මුරපදය (Password)*" type="text" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <Input label="හැඳුනුම්පත් අංකය (NIC)" value={form.nic} onChange={(v) => setForm({ ...form, nic: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="දුරකථන අංකය (Phone)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="දිනක වැටුප (Daily Salary)*" type="number" value={form.daily_salary} onChange={(v) => setForm({ ...form, daily_salary: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">තතත්වය / භූමිකාව (Role)</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold text-stone-800">
                <option value="Baker">Baker</option>
                <option value="Admin">Admin</option>
                <option value="Helper">Helper</option>
                <option value="Packer">Packer</option>
              </select>
            </div>
            <div>
              <label className="block text-stone-700 font-bold mb-1">ස්ත්‍රී/පුරුෂ භාවය (Gender)</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <Input label="ලිපිනය (Address)" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="හදිසි අවස්ථාවකදී සම්බන්ධ විය යුත්තේ (Emergency Contact)" value={form.emergency_contact} onChange={(v) => setForm({ ...form, emergency_contact: v })} placeholder="නම සහ දුරකථන අංකය" />
            <Input label="බැංකු විස්තර (Bank Details)" value={form.bank_details} onChange={(v) => setForm({ ...form, bank_details: v })} placeholder="බැංකුව, ශාඛාව, ගිණුම් අංකය" />
          </div>

          <div>
            <label className="block text-stone-700 font-bold mb-1">සේවක ඡායාරූපය (Photo)</label>
            <div className="flex items-center gap-3">
              {form.photo_url && <img src={form.photo_url} alt="Preview" className="w-12 h-12 rounded-full object-cover border" />}
              <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, false)} className="text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>අවලංගු කරන්න</Button>
            <Button onClick={handleSaveEmployee} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">ගිණුම සාදන්න</Button>
          </div>
        </div>
      </InternalModal>

      {/* EDIT MODAL */}
      <InternalModal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="සේවක තොරතුරු සංස්කරණය">
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="සම්පූර්ණ නම" value={editForm.full_name} onChange={(v) => setEditForm({ ...editForm, full_name: v })} />
            <Input label="පරිශීලක නම (Username)" value={editForm.username} onChange={(v) => setEditForm({ ...editForm, username: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="නව මුරපදය (අවශ්‍ය නම් පමණක් වෙනස් කරන්න)" type="text" value={editForm.password} onChange={(v) => setEditForm({ ...editForm, password: v })} placeholder="හිස්ව තබන්න" />
            <Input label="හැඳුනුම්පත් අංකය (NIC)" value={editForm.nic} onChange={(v) => setEditForm({ ...editForm, nic: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="දුරකථන අංකය" value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} />
            <Input label="දිනක වැටුප" type="number" value={editForm.daily_salary} onChange={(v) => setEditForm({ ...editForm, daily_salary: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">තතත්වය / භූමිකාව (Role)</label>
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold text-stone-800">
                <option value="Baker">Baker</option>
                <option value="Admin">Admin</option>
                <option value="Helper">Helper</option>
                <option value="Packer">Packer</option>
              </select>
            </div>
            <div>
              <label className="block text-stone-700 font-bold mb-1">ස්ත්‍රී/පුරුෂ භාවය (Gender)</label>
              <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <Input label="ලිපිනය" value={editForm.address} onChange={(v) => setEditForm({ ...editForm, address: v })} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="හදිසි අවස්ථාවකදී සම්බන්ධ විය යුත්තේ" value={editForm.emergency_contact} onChange={(v) => setEditForm({ ...editForm, emergency_contact: v })} />
            <Input label="බැංකු විස්තර" value={editForm.bank_details} onChange={(v) => setEditForm({ ...editForm, bank_details: v })} />
          </div>

          <div>
            <label className="block text-stone-700 font-bold mb-1">සේවක ඡායාරූපය (Photo)</label>
            <div className="flex items-center gap-3">
              {editForm.photo_url && <img src={editForm.photo_url} alt="Preview" className="w-12 h-12 rounded-full object-cover border" />}
              <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, true)} className="text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>අවලංගු කරන්න</Button>
            <Button onClick={handleUpdateEmployee} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">පැතිකඩ සුරකින්න</Button>
          </div>
        </div>
      </InternalModal>
    </div>
  );
}