import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Input, Modal } from '@/components/ui';
import { MapPin, Clock, Factory, PlayCircle, CheckCircle2, CheckSquare, History, ChefHat, Calendar, PackageCheck, ArrowLeft, User, Key, CreditCard, Home, Phone, Edit3, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function StaffPortal() {
  const [currentEmployee, setCurrentEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [assignedBatches, setAssignedBatches] = useState<any[]>([]);
  const [packingBatches, setPackingBatches] = useState<any[]>([]);
  const [allBatchesHistory, setAllBatchesHistory] = useState<any[]>([]);
  const [allPackingHistory, setAllPackingHistory] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [bakerySettings, setBakerySettings] = useState<any>({ latitude: 6.6828, longitude: 80.3991, radius_meters: 200 });
  const [loading, setLoading] = useState(true);

  // Modals
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [packingModalOpen, setPackingModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [actualUnits, setActualUnits] = useState('');
  const [wastageUnits, setWastageUnits] = useState('');
  const [closingBatchId, setClosingBatchId] = useState<any>(null);

  // Edit Profile Form State
  const [editForm, setEditForm] = useState({
    phone: '',
    emergency_contact: '',
    address: '',
    bank_details: '',
    photo_url: ''
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Packing Form States
  const [selectedPackingTask, setSelectedPackingTask] = useState<any>(null);
  const [todayPackedUnits, setTodayPackedUnits] = useState('');
  const [packingWastage, setPackingWastage] = useState('');

  // Leave Form States
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveDaysCount, setLeaveDaysCount] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'සුබ උදෑසනක්';
    if (hour < 15) return 'සුබ දහවල්';
    return 'සුබ සන්ධ්‍යාවක්';
  };

  const fetchPortalData = useCallback(async () => {
    setLoading(true);
    try {
      const loggedUserStr = localStorage.getItem('bakery_current_user');
      const empData = loggedUserStr ? JSON.parse(loggedUserStr) : null;
      
      if (empData) {
        const { data: freshEmp } = await supabase.from('bakery_employees').select('*').eq('id', empData.id).single();
        const activeEmp = freshEmp || empData;
        setCurrentEmployee(activeEmp);
        localStorage.setItem('bakery_current_user', JSON.stringify(activeEmp));

        setEditForm({
          phone: activeEmp.phone || '',
          emergency_contact: activeEmp.emergency_contact || '',
          address: activeEmp.address || '',
          bank_details: activeEmp.bank_details || '',
          photo_url: activeEmp.photo_url || ''
        });

        const today = new Date().toISOString().split('T')[0];
        const [attRes, batchRes, packRes, leaveRes, gRes, rRes, mRes, settingsRes] = await Promise.all([
          supabase.from('bakery_attendance').select('*').eq('employee_id', activeEmp.id).eq('attendance_date', today).maybeSingle(),
          supabase.from('bakery_batch_cards').select('*').order('id', { ascending: false }),
          supabase.from('bakery_packing_batches').select('*').order('id', { ascending: false }),
          supabase.from('bakery_leaves').select('*').eq('employee_id', activeEmp.id).order('id', { ascending: false }),
          supabase.from('bakery_goods').select('*'),
          supabase.from('bakery_recipes').select('*').then(res => res, () => ({ data: [] })),
          supabase.from('bakery_raw_materials').select('*').then(res => res, () => ({ data: [] })),
          supabase.from('bakery_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        setAttendance(attRes.data);
        setMyLeaves(leaveRes.data || []);
        setGoods(gRes.data || []);
        setRecipes(rRes.data || []);
        setMaterials(mRes.data || []);
        if (settingsRes.data) {
          setBakerySettings(settingsRes.data);
        }

        const allBatches = batchRes.data || [];
        setAllBatchesHistory(allBatches);

        const allPacking = packRes.data || [];
        setAllPackingHistory(allPacking);

        const fullName = String(activeEmp.full_name || '').trim().toLowerCase();
        const username = String(activeEmp.username || '').trim().toLowerCase();

        const myBatches = allBatches.filter(b => {
          if (!b.bakers_assigned || !b.approved_by_admin) return false;
          const assignedStr = String(b.bakers_assigned).trim().toLowerCase();
          const isMatched = assignedStr.includes(fullName) || (username && assignedStr.includes(username));
          const isCompleted = String(b.status || '').toLowerCase() === 'completed';
          return isMatched && !isCompleted;
        });
        setAssignedBatches(myBatches);

        const myPackingActive = allPacking.filter(p => {
          if (!p.assigned_packer) return false;
          const assignedPackerStr = String(p.assigned_packer).trim().toLowerCase();
          const isMyName = assignedPackerStr.includes(fullName) || (username && assignedPackerStr.includes(username));
          const isNotCompleted = p.status !== 'Completed' && p.status !== 'Transferred to Finished Goods';
          return isMyName && isNotCompleted;
        });
        setPackingBatches(myPackingActive);
      }
    } catch (err) {
      console.error('දත්ත ලබාගැනීමේ දෝෂයකි:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  const goodsMap = new Map(goods.map(g => [String(g.good_id || g.id), g]));
  const matMap = new Map(materials.map(m => [String(m.id || m.material_id), m]));

  const recipeMap = new Map<string, any[]>();
  recipes.forEach(r => {
    const gId = String(r.good_id);
    if (!recipeMap.has(gId)) recipeMap.set(gId, []);
    recipeMap.get(gId)!.push(r);
  });

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const handleCheckIn = async () => {
    if (!currentEmployee) return;
    if (!navigator.geolocation) {
      alert('GPS පහසුකම් ක්‍රියාත්මක නැත.');
      return;
    }

    const BAKERY_LAT = Number(bakerySettings.latitude) || 6.6828;
    const BAKERY_LNG = Number(bakerySettings.longitude) || 80.3991;
    const ALLOWED_RADIUS = Number(bakerySettings.radius_meters) || 200;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = calculateDistance(BAKERY_LAT, BAKERY_LNG, userLat, userLng);

        if (distance > ALLOWED_RADIUS) {
          alert(`පැමිණීම අසාර්ථකයි! ඔබ බේකරියෙන් බැහැරව සිටී (${Math.round(distance)}m). අවසරලත් සීමාව මීටර් ${ALLOWED_RADIUS} කි.`);
          return;
        }

        const checkInLocationLink = `https://www.google.com/maps?q=${userLat},${userLng}`;

        try {
          const { error } = await supabase.from('bakery_attendance').insert({
            employee_id: currentEmployee.id,
            attendance_date: new Date().toISOString().split('T')[0],
            check_in_time: new Date().toISOString(),
            latitude: userLat,
            longitude: userLng,
            location_link: checkInLocationLink,
            status: 'Checked In'
          });

          if (error) throw error;
          alert('පැමිණීම සාර්ථකයි!');
          fetchPortalData();
        } catch (err: any) {
          alert('දෝෂයකි: ' + err.message);
        }
      },
      (error) => alert('GPS ලබා ගැනීමට නොහැකි විය: ' + error.message)
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setEditForm(prev => ({ ...prev, photo_url: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async () => {
    setSubmittingEdit(true);
    try {
      const { error } = await supabase.from('bakery_employees').update({
        phone: editForm.phone,
        emergency_contact: editForm.emergency_contact,
        address: editForm.address,
        bank_details: editForm.bank_details,
        photo_url: editForm.photo_url
      }).eq('id', currentEmployee.id);

      if (error) throw error;

      alert('ඔබගේ විස්තර සාර්ථකව යාවත්කාලීන කරන ලදී!');
      setEditProfileModalOpen(false);
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
    setSubmittingEdit(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      alert('කරුණාකර වලංගු නව මුරපදයක් ඇතුළත් කරන්න (අවම අක්ෂර 4ක්).');
      return;
    }

    setSubmittingPassword(true);
    try {
      const { error } = await supabase.from('bakery_employees').update({ password: newPassword }).eq('id', currentEmployee.id);
      if (error) throw error;

      alert('මුරපදය සාර්ථකව වෙනස් කරන ලදී!');
      setPasswordModalOpen(false);
      setNewPassword('');
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
    setSubmittingPassword(false);
  };

  const handleAcceptBatch = async (batchId: number) => {
    try {
      const { error } = await supabase.from('bakery_batch_cards').update({ status: 'Accepted' }).eq('id', batchId);
      if (error) throw error;
      alert('රැකියාව භාරගන්නා ලදී!');
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
  };

  const handleStartBatch = async (batchId: number) => {
    try {
      const { error } = await supabase.from('bakery_batch_cards').update({ 
        status: 'In Progress', 
        start_time: new Date().toISOString() 
      }).eq('id', batchId);
      if (error) throw error;
      alert('වැඩ ආරම්භ කරන ලදී!');
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
  };

  const handleCompleteBatchSubmit = async () => {
    if (!actualUnits) {
      alert('සැබෑ නිෂ්පාදිත ප්‍රමාණය ඇතුළත් කරන්න.');
      return;
    }

    try {
      const { error } = await supabase.from('bakery_batch_cards').update({
        status: 'Completed',
        actual_units: parseFloat(actualUnits) || 0,
        wastage_units: parseFloat(wastageUnits) || 0,
        finish_time: new Date().toISOString()
      }).eq('id', closingBatchId);

      if (error) throw error;
      alert('බැච් එක සාර්ථකව අවසන් කර ඉතිහාසයට එකතු කරන ලදී!');
      setCompleteModalOpen(false);
      setActualUnits('');
      setWastageUnits('');
      setClosingBatchId(null);
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
  };

  const handleAcceptPacking = async (pId: number) => {
    try {
      const { error } = await supabase.from('bakery_packing_batches').update({
        status: 'In Progress',
        start_time: new Date().toISOString()
      }).eq('id', pId);

      if (error) throw error;
      alert('පැකින් වැඩ භාරගන්නා ලදී!');
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
  };

  const handlePackingProgressSubmit = async (isCompleted: boolean) => {
    if (!todayPackedUnits) {
      alert('අද පැකට් කළ ප්‍රමාණය ඇතුළත් කරන්න.');
      return;
    }

    const packedNum = parseFloat(todayPackedUnits) || 0;
    const wastageNum = parseFloat(packingWastage) || 0;
    const currentPacked = Number(selectedPackingTask.packed_units || 0);
    const currentWastage = Number(selectedPackingTask.wastage_units || 0);
    
    const newTotalPacked = currentPacked + packedNum;
    const newTotalWastage = currentWastage + wastageNum;
    const newRemaining = Math.max(0, Number(selectedPackingTask.planned_units) - newTotalPacked - newTotalWastage);
    const newStatus = isCompleted || newRemaining === 0 ? 'Completed' : 'In Progress';

    try {
      const updateData: any = {
        packed_units: newTotalPacked,
        wastage_units: newTotalWastage,
        remaining_units: newRemaining,
        status: newStatus,
        finish_time: newStatus === 'Completed' ? new Date().toISOString() : null
      };

      const { error } = await supabase.from('bakery_packing_batches').update(updateData).eq('id', selectedPackingTask.id);

      if (error) throw error;
      alert(newStatus === 'Completed' ? 'පැකින් වැඩ සම්පූර්ණයෙන්ම අවසන් කරන ලදී!' : 'වැඩේ තාවකාලිකව නතර කරන ලදී.');
      setPackingModalOpen(false);
      setSelectedPackingTask(null);
      setTodayPackedUnits('');
      setPackingWastage('');
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
  };

  const getElapsedTime = (startTimeStr: string, finishTimeStr?: string) => {
    if (!startTimeStr) return 'පටන් ගෙන නැත';
    const start = new Date(startTimeStr).getTime();
    const end = finishTimeStr ? new Date(finishTimeStr).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    
    const diffSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    if (hours > 0) return `${hours} පැය ${mins} මිනි ${secs} තත්`;
    return `${mins} මිනිත්තු ${secs} තත්පර`;
  };

  const handleApplyLeave = async () => {
    if (!leaveDate || !leaveDaysCount || !leaveReason) {
      alert('කරුණාකර දිනය, අවශ්‍ය දින ගණන සහ හේතුව ඇතුළත් කරන්න.');
      return;
    }

    const selectedDate = new Date(leaveDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 5) {
      alert('අවම වශයෙන් දින 5 කට පෙර නිවාඩු ඉල්ලුම් කළ යුතුය!');
      return;
    }

    setSubmittingLeave(true);
    try {
      const fullReason = `${leaveReason} (දින ${leaveDaysCount} ක නිවාඩුවක්)`;
      const { error } = await supabase.from('bakery_leaves').insert({
        employee_id: currentEmployee.id,
        employee_name: currentEmployee.full_name,
        leave_date: leaveDate,
        reason: fullReason,
        status: 'Pending'
      });

      if (error) throw error;
      alert('නිවාඩු ඉල්ලුම්පත්‍රය සාර්ථකව යවන ලදී!');
      setLeaveDate('');
      setLeaveDaysCount('1');
      setLeaveReason('');
      fetchPortalData();
    } catch (err: any) {
      alert('දෝෂයකි: ' + err.message);
    }
    setSubmittingLeave(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4 pb-12 max-w-xl mx-auto px-2">
      {/* ඉහළ ශීර්ෂය සහ සංයුක්ත "Change PW" බොත්තම */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          {currentEmployee?.photo_url ? (
            <img src={currentEmployee.photo_url} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-white/80 shadow" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-amber-500/80 flex items-center justify-center font-bold text-white text-sm shadow">
              {currentEmployee?.full_name?.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-[11px] font-bold tracking-wider uppercase opacity-90">සේවක පෝටලය</h1>
            <span className="text-xs sm:text-sm font-semibold text-amber-100">
              {getGreeting()}, {currentEmployee?.full_name}!
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button onClick={() => setProfileModalOpen(true)} className="bg-amber-800/90 hover:bg-amber-900 text-white text-[11px] py-1.5 px-3 font-bold rounded-xl shadow-sm">
            මම ගැන (Profile)
          </Button>
          <Button onClick={() => setPasswordModalOpen(true)} className="bg-stone-900 hover:bg-black text-white text-[10px] py-1 px-2.5 font-bold rounded-lg shadow-sm tracking-wide">
            Change PW
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button 
          onClick={() => setLeaveModalOpen(true)} 
          className="bg-amber-700 hover:bg-amber-800 text-white text-xs py-2.5 font-bold flex items-center justify-center gap-1.5 shadow-sm rounded-xl"
        >
          <Calendar className="h-4 w-4" /> නිවාඩු ඉල්ලන්න
        </Button>
        <Button 
          onClick={() => setHistoryModalOpen(true)} 
          variant="secondary" 
          className="bg-white text-stone-800 border-stone-300 hover:bg-stone-50 text-xs py-2.5 font-bold flex items-center justify-center gap-1.5 shadow-sm rounded-xl"
        >
          <History className="h-4 w-4 text-amber-700" /> මම කරපු වැඩ (ඉතිහාසය)
        </Button>
      </div>

      <Card className="p-3 space-y-2 border-amber-500 border-l-4 rounded-xl shadow-sm">
        <h3 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-amber-600" /> GPS පැමිණීම (Attendance)
        </h3>
        <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 flex justify-between items-center text-xs">
          <div>
            <span className="text-stone-400 block text-[10px]">තත්ත්වය:</span>
            <span className="font-bold text-emerald-700">{attendance ? attendance.status : 'පැමිණීම සටහන් කර නැත'}</span>
          </div>
          {!attendance ? (
            <Button onClick={handleCheckIn} className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] py-1.5 px-3 font-bold rounded-lg">
              <Clock className="h-3 w-3 inline mr-1" /> Check-In
            </Button>
          ) : (
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> පැමිණ ඇත
            </span>
          )}
        </div>
      </Card>

      {/* PACKING TASKS */}
      <div className="space-y-3">
        <h3 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
          <PackageCheck className="h-3.5 w-3.5 text-amber-600" /> පැකින් කාර්යයන් (Assigned Packing Tasks)
        </h3>

        {packingBatches.length === 0 ? (
          <div className="bg-white p-4 rounded-xl border border-stone-200 text-center text-xs text-stone-400 shadow-sm">
            පැකින් කාර්යයන් නොමැත.
          </div>
        ) : (
          packingBatches.map(pTask => {
            const prod = goodsMap.get(String(pTask.good_id));
            const pName = prod?.product_code ? `${prod.product_code} — ${prod.product_name}` : (prod?.product_name || 'බේකරි භාණ්ඩය');
            const isPendingPacking = pTask.status === 'Pending Packing' || pTask.status === 'Assigned';

            return (
              <div key={pTask.id} className="bg-white p-4 rounded-xl border border-stone-200 space-y-3 shadow-sm text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold bg-stone-100 px-2.5 py-1 rounded">
                    {pTask.batch_number}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    pTask.status === 'In Progress' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pTask.status}
                  </span>
                </div>

                <div className="space-y-1.5 bg-stone-50 p-3 rounded-lg border text-xs">
                  <p className="font-bold text-stone-900 text-sm">{pName}</p>
                  <p className="text-stone-600">මුළු ප්‍රමාණය: <strong className="text-stone-900">{pTask.planned_units}</strong></p>
                  <p className="text-emerald-700">පැකට් කළ: <strong>{pTask.packed_units}</strong> | හානි වූ: <strong className="text-red-600">{pTask.wastage_units || 0}</strong> | ඉතිරි: <strong className="text-amber-700">{pTask.remaining_units}</strong></p>

                  {pTask.status === 'In Progress' && pTask.start_time && (
                    <div className="border-t pt-2 mt-2 flex items-center justify-between text-blue-700 font-bold bg-blue-50 p-2.5 rounded">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4 animate-spin text-blue-600" /> කාලය:
                      </span>
                      <span className="font-mono text-xs bg-white px-2.5 py-1 rounded border border-blue-200">
                        {getElapsedTime(pTask.start_time, pTask.finish_time)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t gap-2">
                  {isPendingPacking ? (
                    <Button onClick={() => handleAcceptPacking(pTask.id)} className="bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 px-3 font-bold rounded-lg">
                      <CheckSquare className="h-3.5 w-3.5 inline mr-1" /> වැඩ භාරගන්න (Accept)
                    </Button>
                  ) : (
                    <Button onClick={() => { setSelectedPackingTask(pTask); setPackingModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 px-3 font-bold rounded-lg">
                      <PackageCheck className="h-3.5 w-3.5 inline mr-1" /> ප්‍රගතිය / තාවකාලිකව නවතන්න
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PRODUCTION BATCH CARDS */}
      <div className="space-y-3">
        <h3 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
          <Factory className="h-3.5 w-3.5 text-amber-600" /> මට පැවරී ඇති නිෂ්පාදන බැච් (Assigned Batches)
        </h3>

        {assignedBatches.length === 0 ? (
          <div className="bg-white p-4 rounded-xl border border-stone-200 text-center text-xs text-stone-400 shadow-sm">
            මෙම නමට අනුමත කරන ලද නිෂ්පාදන බැච් පවරා නැත.
          </div>
        ) : (
          assignedBatches.map((batch) => {
            const prod = goodsMap.get(String(batch.good_id));
            const productRecipes = recipeMap.get(String(batch.good_id)) || [];
            const productName = prod?.product_code ? `${prod.product_code} — ${prod.product_name}` : (prod?.product_name || 'බේකරි භාණ්ඩය');

            return (
              <div key={batch.id} className="bg-white p-4 rounded-xl border border-stone-200 space-y-3 shadow-sm text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded text-xs">
                    {batch.batch_number}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    batch.status === 'Accepted' ? 'bg-purple-100 text-purple-800' :
                    batch.status === 'In Progress' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {batch.status || 'Pending'}
                  </span>
                </div>

                <div className="space-y-1.5 bg-stone-50 p-3 rounded-lg border text-xs">
                  <p className="font-bold text-stone-900 text-sm">{productName}</p>
                  <p className="text-stone-600">සැලසුම් කළ ප්‍රමාණය: <strong className="text-stone-900">{batch.planned_units || batch.planned_qty || 'නැත'}</strong></p>

                  <div className="border-t pt-2 mt-2">
                    <p className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5 mb-1">
                      <ChefHat className="h-3.5 w-3.5 text-amber-600" /> අවශ්‍ය රෙසිපි අමුද්‍රව්‍ය:
                    </p>
                    {productRecipes.length === 0 ? (
                      <p className="text-[10px] text-stone-400 italic">රෙසිපි එකක් සකසා නැත.</p>
                    ) : (
                      <div className="space-y-1 bg-white p-2.5 rounded border max-h-32 overflow-y-auto">
                        {productRecipes.map((r, rIdx) => {
                          const mat = matMap.get(String(r.raw_material_id));
                          const qtyPerBatch = Number(r.quantity_per_batch) || 0;
                          return (
                            <div key={rIdx} className="flex justify-between text-[11px] text-stone-700 border-b border-stone-100 pb-0.5">
                              <span>{mat?.name || mat?.material_name || 'අමුද්‍රව්‍ය'}</span>
                              <span className="font-mono font-bold text-amber-700">{qtyPerBatch.toFixed(2)} {mat?.unit || 'Kg'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {batch.status === 'In Progress' && batch.start_time && (
                    <div className="border-t pt-2 mt-2 flex items-center justify-between text-blue-700 font-bold bg-blue-50 p-2.5 rounded">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4 animate-spin text-blue-600" /> ක්‍රියාත්මක කාලය:
                      </span>
                      <span className="font-mono text-xs bg-white px-2.5 py-1 rounded border border-blue-200">
                        {getElapsedTime(batch.start_time, batch.finish_time)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t gap-2">
                  {!batch.status || batch.status === 'Pending' ? (
                    <Button onClick={() => handleAcceptBatch(batch.id)} className="bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 px-3 font-bold rounded-lg">
                      <CheckSquare className="h-3.5 w-3.5 inline mr-1" /> වැඩ භාරගන්න (Accept)
                    </Button>
                  ) : batch.status === 'Accepted' ? (
                    <Button onClick={() => handleStartBatch(batch.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 px-3 font-bold rounded-lg">
                      <PlayCircle className="h-3.5 w-3.5 inline mr-1" /> වැඩ ආරම්භ කරන්න
                    </Button>
                  ) : (
                    <Button onClick={() => { setClosingBatchId(batch.id); setCompleteModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 px-3 font-bold rounded-lg">
                      <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" /> වැඩ අවසන් කර ක්ලෝස් කරන්න
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: PROFILE */}
      <Modal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="මගේ පෞද්ගලික විස්තර (My Profile)">
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between bg-amber-50 p-4 rounded-xl border border-amber-200">
            <div className="flex items-center gap-4">
              {currentEmployee?.photo_url ? (
                <img src={currentEmployee.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-amber-600 shadow" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-amber-200 flex items-center justify-center font-bold text-amber-800 text-base">
                  {currentEmployee?.full_name?.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-bold text-stone-900 text-base">{currentEmployee?.full_name}</h3>
                <p className="text-amber-800 font-bold uppercase">{currentEmployee?.role}</p>
                <p className="text-stone-500 font-mono text-[11px]">Username: {currentEmployee?.username}</p>
              </div>
            </div>
            
            <Button onClick={() => { setProfileModalOpen(false); setEditProfileModalOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center gap-1 font-bold rounded-xl">
              <Edit3 className="h-3.5 w-3.5" /> Edit Profile
            </Button>
          </div>

          <div className="space-y-2 bg-stone-50 p-4 rounded-xl border">
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-stone-500">ජාතික හැඳුනුම්පත (NIC):</span>
              <span className="font-bold font-mono text-stone-900">{currentEmployee?.nic || 'නැත'}</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-stone-500">දුරකථන අංකය:</span>
              <span className="font-bold text-stone-900">{currentEmployee?.phone || 'නැත'}</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-stone-500">හදිසි ඇමතුම් අංකය:</span>
              <span className="font-bold text-stone-900">{currentEmployee?.emergency_contact || 'නැත'}</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-stone-500">ලිපිනය:</span>
              <span className="font-bold text-stone-900">{currentEmployee?.address || 'නැත'}</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-stone-500">දිනක වැටුප:</span>
              <span className="font-bold font-mono text-emerald-700">Rs. {Number(currentEmployee?.daily_salary || 0).toLocaleString()} / day</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">බැංකු විස්තර:</span>
              <span className="font-bold text-stone-900">{currentEmployee?.bank_details || 'නැත'}</span>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="secondary" onClick={() => setProfileModalOpen(false)}>වසන්න</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: EDIT PROFILE */}
      <Modal open={editProfileModalOpen} onClose={() => setEditProfileModalOpen(false)} title="පැතිකඩ යාවත්කාලීන කිරීම (Edit Profile)">
        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-4 bg-stone-50 p-3 rounded-xl border">
            {editForm.photo_url ? (
              <img src={editForm.photo_url} alt="Preview" className="w-14 h-14 rounded-full object-cover border-2 border-amber-600" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold">ඡායාරූපය</div>
            )}
            <div>
              <label className="block font-bold text-stone-700 mb-1">නව ඡායාරූපයක් එක් කරන්න</label>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="text-xs" />
            </div>
          </div>

          <Input label="දුරකථන අංකය" value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} placeholder="0771234567" />
          <Input label="හදිසි ඇමතුම් අංකය" value={editForm.emergency_contact} onChange={(v) => setEditForm({ ...editForm, emergency_contact: v })} placeholder="0719876543" />
          <Input label="ලිපිනය" value={editForm.address} onChange={(v) => setEditForm({ ...editForm, address: v })} placeholder="පදිංචි ලිපිනය" />
          <Input label="බැංකු ගිණුම් විස්තර" value={editForm.bank_details} onChange={(v) => setEditForm({ ...editForm, bank_details: v })} placeholder="බැංකුව, ශාඛාව, ගිණුම් අංකය" />

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="secondary" onClick={() => setEditProfileModalOpen(false)}>අවලංගු කරන්න</Button>
            <Button onClick={handleUpdateProfile} disabled={submittingEdit} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl">
              {submittingEdit ? 'යාවත්කාලීන කරමින්...' : 'පැතිකඩ සුරකින්න'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CHANGE PASSWORD */}
      <Modal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="මුරපදය වෙනස් කිරීම (Change Password)">
        <div className="space-y-4 text-xs">
          <Input 
            label="නව මුරපදය (New Password)" 
            type="text" 
            value={newPassword} 
            onChange={setNewPassword} 
            placeholder="අවම අක්ෂර 4ක් ඇතුළත් කරන්න" 
          />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="secondary" onClick={() => setPasswordModalOpen(false)}>අවලංගු කරන්න</Button>
            <Button onClick={handleChangePassword} disabled={submittingPassword} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl">
              {submittingPassword ? 'වෙනස් කරමින්...' : 'මුරපදය වෙනස් කරන්න'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: PACKING PROGRESS */}
      {packingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-stone-900 border-b pb-2">පැකින් ප්‍රගතිය සටහන් කිරීම: {selectedPackingTask?.batch_number}</h3>
            
            <div className="bg-stone-50 p-3 rounded-xl border space-y-1">
              <p>මුළු ප්‍රමාණය: <strong className="text-stone-900">{selectedPackingTask?.planned_units}</strong></p>
              <p>පැකට් කළ: <strong className="text-emerald-700">{selectedPackingTask?.packed_units}</strong></p>
              <p>හානි වූ: <strong className="text-red-600">{selectedPackingTask?.wastage_units || 0}</strong></p>
              <p>ඉතිරි: <strong className="text-amber-700">{selectedPackingTask?.remaining_units}</strong></p>
            </div>

            <Input label="අද පැකට් කළ ප්‍රමාණය" type="number" value={todayPackedUnits} onChange={setTodayPackedUnits} placeholder="උදා: 150" />
            <Input label="හානි වූ / ඉවත් කළ ප්‍රමාණය" type="number" value={packingWastage} onChange={setPackingWastage} placeholder="උදා: 5" />

            <div className="flex flex-col gap-2 pt-3 border-t">
              <Button onClick={() => handlePackingProgressSubmit(false)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl">
                ⏸️ තාවකාලිකව නවතන්න (Pause)
              </Button>
              <Button onClick={() => handlePackingProgressSubmit(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl">
                ✅ සම්පූර්ණයෙන්ම ඉවරයි (Complete)
              </Button>
              <Button variant="secondary" onClick={() => setPackingModalOpen(false)}>අවලංගු කරන්න</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE PRODUCTION BATCH */}
      <Modal open={completeModalOpen} onClose={() => setCompleteModalOpen(false)} title="නිෂ්පාදන බැච් එක අවසන් කිරීම (Close Batch)">
        <div className="space-y-4 text-xs">
          <p className="text-stone-600">නිෂ්පාදනය සාර්ථකව අවසන් කිරීමට සැබෑ දත්ත ඇතුළත් කරන්න:</p>
          <Input label="නිෂ්පාදිත සැබෑ ප්‍රමාණය (Actual Units)" type="number" value={actualUnits} onChange={setActualUnits} placeholder="උදා: 200" />
          <Input label="හානි වූ / නාස්ති වූ ප්‍රමාණය (Wastage Units)" type="number" value={wastageUnits} onChange={setWastageUnits} placeholder="උදා: 0" />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="secondary" onClick={() => setCompleteModalOpen(false)}>අවලංගු කරන්න</Button>
            <Button onClick={handleCompleteBatchSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">ක්ලෝස් කරන්න</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: LEAVE APPLICATION & STATUS TRACKER */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-bold text-stone-900">නිවාඩු ඉල්ලුම් කිරීම සහ තත්ත්වය (Leave Portal)</h3>
              <Button 
                variant="secondary" 
                onClick={() => setLeaveModalOpen(false)}
                className="text-xs py-1 px-2.5 flex items-center gap-1 bg-stone-100 hover:bg-stone-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> ආපසු (Back)
              </Button>
            </div>
            
            <p className="text-stone-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
              ⚠️ සටහන: නිවාඩු ඉල්ලුම් කළ යුත්තේ අවම වශයෙන් දවස් 5 කට පෙරය.
            </p>

            <div className="space-y-3 bg-stone-50 p-4 rounded-xl border">
              <h4 className="font-bold text-stone-800">නව නිවාඩු ඉල්ලුම්පත්‍රයක් යැවීම</h4>
              <div className="space-y-1">
                <label className="block font-bold text-stone-700">නිවාඩු පටන් ගන්නා දිනය (Start Date)</label>
                <input 
                  type="date" 
                  value={leaveDate} 
                  onChange={(e) => setLeaveDate(e.target.value)} 
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 bg-white font-bold text-xs" 
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-700">අවශ්‍ය දින ගණන (Number of Days)</label>
                <input 
                  type="number"
                  min="1"
                  value={leaveDaysCount} 
                  onChange={(e) => setLeaveDaysCount(e.target.value)} 
                  placeholder="උදා: 2" 
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 bg-white font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-700">හේතුව (Reason)</label>
                <input 
                  type="text"
                  value={leaveReason} 
                  onChange={(e) => setLeaveReason(e.target.value)} 
                  placeholder="උදා: පෞද්ගලික කටයුත්තක් සඳහා" 
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 bg-white text-xs"
                />
              </div>

              <Button onClick={handleApplyLeave} disabled={submittingLeave} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl py-2 mt-2">
                {submittingLeave ? 'යොමු කරමින් පවතී...' : 'නිවාඩු ඉල්ලුම්පත්‍රය යවන්න'}
              </Button>
            </div>

            {/* මම ඉල්ලපු නිවාඩු වල තත්ත්වය පෙන්වන කොටස */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-bold text-stone-800">මම ඉල්ලපු නිවාඩු ඉතිහාසය සහ තත්ත්වය (Leave Status)</h4>
              {myLeaves.length === 0 ? (
                <p className="text-stone-400 italic text-center py-3">තවම නිවාඩු ඉල්ලුම් කර නැත.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {myLeaves.map((lv, idx) => {
                    const status = String(lv.status || 'Pending').toLowerCase();
                    return (
                      <div key={idx} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm">
                        <div>
                          <p className="font-bold text-stone-900">දිනය: {lv.leave_date}</p>
                          <p className="text-stone-600 text-[11px] mt-0.5">{lv.reason}</p>
                        </div>
                        <div>
                          {status === 'approved' ? (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px] flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Approved (অনুমোদিত)
                            </span>
                          ) : status === 'rejected' ? (
                            <span className="bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-full text-[10px] flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> Rejected (ප්‍රතික්ෂේපිතයි)
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px] flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Pending (සලකා බලමින්)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>වසන්න</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORY */}
      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title={`මම කරපු වැඩ (ඉතිහාසය): ${currentEmployee?.full_name}`}>
        <div className="space-y-3 text-xs">
          <p className="text-stone-500">ඔබ විසින් සිදු කරන ලද සම්පූර්ණ කළ වැඩ ලැයිස්තුව:</p>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {allPackingHistory.filter(p => {
              if (!p.assigned_packer) return false;
              return String(p.assigned_packer).toLowerCase() === String(currentEmployee?.full_name || '').toLowerCase() && p.status === 'Completed';
            }).map((pHist, idx) => {
              const prod = goodsMap.get(String(pHist.good_id));
              const pName = prod?.product_code ? `${prod.product_code} — ${prod.product_name}` : (prod?.product_name || 'බේකරි භාණ්ඩය');
              return (
                <div key={`p-${idx}`} className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border text-[11px]">{pHist.batch_number}</span>
                    <p className="text-stone-800 font-bold mt-1">පැකින්: {pName}</p>
                    <span className="text-[10px] text-stone-500 block mt-0.5">පැකට් කළ: {pHist.packed_units} | හානි: {pHist.wastage_units || 0}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 font-bold text-[9px] px-2 py-0.5 rounded uppercase">සම්පූර්ණයි</span>
                </div>
              );
            })}

            {allBatchesHistory.filter(b => {
              if (!b.bakers_assigned) return false;
              const assignedStr = String(b.bakers_assigned).toLowerCase();
              const fullName = String(currentEmployee?.full_name || '').toLowerCase();
              return fullName && assignedStr.includes(fullName) && String(b.status || '').toLowerCase() === 'completed';
            }).map((hBatch, idx) => {
              const prod = goodsMap.get(String(hBatch.good_id));
              const hProductName = prod?.product_code ? `${prod.product_code} — ${prod.product_name}` : (prod?.product_name || 'බේකරි භාණ්ඩය');
              return (
                <div key={`b-${idx}`} className="bg-stone-50 p-3 rounded-xl border flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border text-[11px]">{hBatch.batch_number}</span>
                    <p className="text-stone-800 font-bold mt-1">නිෂ්පාදනය: {hProductName}</p>
                    <span className="text-[10px] text-stone-500 block mt-0.5">සැබෑ නිෂ්පාදනය: {hBatch.actual_units} | හානි: {hBatch.wastage_units || 0}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 font-bold text-[9px] px-2 py-0.5 rounded uppercase">සම්පූර්ණයි</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button variant="secondary" onClick={() => setHistoryModalOpen(false)}>වසන්න</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}