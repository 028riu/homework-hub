const HH_ADMIN = window.__HOMEWORK_HUB_ADMIN__;
if (!HH_ADMIN) {
  console.error('Homework Hub Schedule: admin bridge chưa sẵn sàng.');
} else {
  const db = HH_ADMIN.db;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const days = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6'];
  const slots = [
    {key:'p1', label:'Tiết 1'}, {key:'p2', label:'Tiết 2'}, {key:'p3', label:'Tiết 3'},
    {key:'p4', label:'Tiết 4'}, {key:'lunch', label:'🍱 Nghỉ trưa'},
    {key:'p5', label:'Tiết 5'}, {key:'p6', label:'Tiết 6'}, {key:'p7', label:'Tiết 7'}
  ];
  let weekStart = monday(new Date());
  let schedule = new Map();
  let unsubscribe = null;

  function pad(n){ return String(n).padStart(2,'0'); }
  function keyDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function monday(input){
    const d = new Date(input); d.setHours(12,0,0,0);
    const day = d.getDay(); const diff = day === 0 ? -6 : 1-day;
    d.setDate(d.getDate()+diff); return d;
  }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function docId(date, slot){ return `${date}_${slot}`; }
  function currentWeekDates(){ return days.map((_,i)=>addDays(weekStart,i)); }
  function niceDate(d){ return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}); }
  function syncDateInput(){ const el=$('scheduleWeek'); if(el) el.value=keyDate(weekStart); }

  function renderTable(){
    const c=$('classScheduleTable'); if(!c) return;
    const dates=currentWeekDates();
    let html='<div class="schedule-table-wrap"><table class="class-schedule-table"><thead><tr><th>Ngày</th>';
    for(const slot of slots) html += `<th>${slot.label}</th>`;
    html += '</tr></thead><tbody>';
    dates.forEach((date,di)=>{
      html += `<tr><th><b>${days[di]}</b><small>${niceDate(date)}</small></th>`;
      slots.forEach(slot=>{
        const item=schedule.get(docId(keyDate(date),slot.key)) || {};
        const filled = item.subject || item.lesson || item.teacher || item.note;
        html += `<td><button type="button" class="schedule-cell ${filled?'filled':''}" data-schedule-edit="${docId(keyDate(date),slot.key)}" data-date="${keyDate(date)}" data-slot="${slot.key}">
          ${filled ? `<strong>${esc(item.subject||'Chưa ghi môn')}</strong><span>${esc(item.lesson||'Chưa ghi nội dung')}</span>${item.teacher||item.note?`<small>${item.teacher?'👨‍🏫 '+esc(item.teacher):''}${item.note?' · 💬 '+esc(item.note):''}</small>`:''}` : '<span class="schedule-empty">＋ Thêm</span>'}
        </button></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    c.innerHTML=html;
    c.querySelectorAll('[data-schedule-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.date,b.dataset.slot));
  }

  function openEditor(date,slot){
    const item=schedule.get(docId(date,slot))||{};
    const slotInfo=slots.find(x=>x.key===slot)||{label:slot};
    const existing=document.getElementById('scheduleEditorDialog'); existing?.remove();
    const d=document.createElement('dialog'); d.id='scheduleEditorDialog';
    d.innerHTML=`<form method="dialog" class="modal schedule-editor-modal">
      <div class="panel-title"><div><p class="eyebrow">CLASS SCHEDULE</p><h2>🏫 ${esc(days[Math.max(0,new Date(date+'T12:00:00').getDay()-1)])} · ${esc(slotInfo.label)}</h2><p class="muted">${esc(new Date(date+'T12:00:00').toLocaleDateString('vi-VN',{dateStyle:'full'}))}</p></div><button value="cancel" class="icon-btn" type="submit" aria-label="Đóng">×</button></div>
      <label>📚 Môn học<input id="scSubject" maxlength="80" value="${esc(item.subject||'')}" placeholder="Ví dụ: Toán"></label>
      <label>📖 Nội dung bài học<textarea id="scLesson" rows="4" maxlength="500" placeholder="Hôm nay học bài gì?">${esc(item.lesson||'')}</textarea></label>
      <label>👨‍🏫 Thầy cô<input id="scTeacher" maxlength="100" value="${esc(item.teacher||'')}" placeholder="Không bắt buộc"></label>
      <label>💬 Nhận xét / lời dặn<textarea id="scNote" rows="3" maxlength="500" placeholder="Không bắt buộc">${esc(item.note||'')}</textarea></label>
      <div class="schedule-editor-actions"><button type="button" class="danger" id="scDelete">🗑 Xóa ô này</button><button type="submit" class="primary" value="save" id="scSave">💾 Lưu</button></div>
      <p id="scError" class="error"></p>
    </form>`;
    document.body.appendChild(d); d.showModal();
    $('scDelete').onclick=async()=>{ if(!confirm('Xóa nội dung của ô này?')) return; try{await window.__HH_DELETE_SCHEDULE(date,slot);d.close();}catch(e){$('scError').textContent=e.message;} };
    d.addEventListener('close',()=>d.remove(),{once:true});
    d.querySelector('form').addEventListener('submit',async e=>{
      if(e.submitter?.value!=='save') return;
      e.preventDefault();
      const payload={date,slot,subject:$('scSubject').value.trim(),lesson:$('scLesson').value.trim(),teacher:$('scTeacher').value.trim(),note:$('scNote').value.trim(),updatedAt:(await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')).serverTimestamp()};
      if(!payload.subject&&!payload.lesson&&!payload.teacher&&!payload.note){$('scError').textContent='Hãy nhập ít nhất môn học hoặc nội dung.';return;}
      try{await window.__HH_SAVE_SCHEDULE(date,slot,payload);d.close();}catch(err){$('scError').textContent=err.message;}
    });
  }

  async function subscribe(){
    if(unsubscribe){unsubscribe();unsubscribe=null;}
    const {collection,onSnapshot}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
    const dates=currentWeekDates();
    const wanted=new Set(); dates.forEach(d=>slots.forEach(s=>wanted.add(docId(keyDate(d),s.key))));
    unsubscribe=onSnapshot(collection(db,'class_schedule'),snap=>{
      schedule=new Map(); snap.docs.forEach(x=>{const v=x.data(); if(wanted.has(x.id)||dates.some(d=>keyDate(d)===v.date)) schedule.set(x.id,{id:x.id,...v});}); renderTable();
      const st=$('scheduleStatus'); if(st) st.textContent=`${[...schedule.values()].filter(x=>x.subject||x.lesson||x.teacher||x.note).length} ô đã có nội dung`;
    },err=>{console.error('Homework Hub Schedule:',err);const st=$('scheduleStatus');if(st)st.textContent='❌ Không thể tải bảng: '+err.message;});
  }

  window.__HH_SAVE_SCHEDULE=async(date,slot,payload)=>{
    const {doc,setDoc}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
    const u=HH_ADMIN.currentUser;
    await setDoc(doc(db,'class_schedule',docId(date,slot)),{...payload,updatedBy:u?.email||'',updatedAt:(await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')).serverTimestamp()},{merge:true});
  };
  window.__HH_DELETE_SCHEDULE=async(date,slot)=>{
    const {doc,deleteDoc}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
    await deleteDoc(doc(db,'class_schedule',docId(date,slot)));
  };

  async function init(){
    const week=$('scheduleWeek'); if(!week)return;
    weekStart=monday(week.value?new Date(week.value+'T12:00:00'):new Date()); syncDateInput();
    $('schedulePrev').onclick=()=>{weekStart=addDays(weekStart,-7);syncDateInput();subscribe();};
    $('scheduleNext').onclick=()=>{weekStart=addDays(weekStart,7);syncDateInput();subscribe();};
    $('scheduleToday').onclick=()=>{weekStart=monday(new Date());syncDateInput();subscribe();};
    week.onchange=()=>{weekStart=monday(new Date(week.value+'T12:00:00'));syncDateInput();subscribe();};
    renderTable(); await subscribe();
  }
  document.querySelector('[data-admin-tab="schedule"]')?.addEventListener('click',()=>{setTimeout(init,0);});
  if(document.querySelector('[data-page="schedule"]') && !document.querySelector('[data-page="schedule"]').classList.contains('hidden')) init();
}
