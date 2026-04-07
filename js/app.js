const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const LocoLink = (() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  const nowYear = () => ($("#year") && ($("#year").textContent = new Date().getFullYear()));

  // ---------- localStorage helpers ----------
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  // ---------- time overlap ----------
  // times are "HH:MM" strings; compares same day only (we check day equality outside)
  const timeOverlap = (aStart, aEnd, bStart, bEnd) => {
    const toMin = t => {
      const [h,m] = t.split(":").map(Number);
      return h*60 + m;
    };
    const s1 = toMin(aStart), e1 = toMin(aEnd), s2 = toMin(bStart), e2 = toMin(bEnd);
    return s1 < e2 && s2 < e1; // strict overlap
  };

  // ---------- dynamic slot row ----------
  const makeSlotRow = (onRemove) => {
    const row = document.createElement("div");
    row.className = "slot";
    row.innerHTML = `
      <label>Day
        <select class="slot-day" required>
          ${DAYS.map(d=>`<option value="${d}">${d}</option>`).join("")}
        </select>
      </label>
      <label>Start
        <input class="slot-start" type="time" required value="16:00"/>
      </label>
      <label>End
        <input class="slot-end" type="time" required value="20:00"/>
      </label>
      <button type="button" class="btn btn-ghost remove">Remove</button>
    `;
    $(".remove", row).addEventListener("click", () => onRemove(row));
    return row;
  };

  // ----------------------------------------- SEEKER
  const initSeeker = () => {
    nowYear();

    const form = $("#seekerForm");
    const builder = $("#availabilityBuilder");
    const addBtn = $("#addSlotBtn");
    const jobList = $("#jobList");
    const emptyState = $("#emptyState");
    const refreshBtn = $("#refreshJobsBtn");
    const searchTitle = $("#searchTitle");
    const maxDistance = $("#maxDistance");

    // restore saved profile + slots
    const saved = read("seekerProfile", { name:"", location:"", skills:"", slots:[] });
    form.name.value = saved.name || "";
    form.location.value = saved.location || "";
    form.skills.value = saved.skills || "";

    const removeRow = (row) => row.remove();
    const addRow = (slot) => {
      const r = makeSlotRow(removeRow);
      if (slot){
        $(".slot-day", r).value = slot.day;
        $(".slot-start", r).value = slot.start;
        $(".slot-end", r).value = slot.end;
      }
      builder.appendChild(r);
    };

    // ensure at least one slot row initially
    if (saved.slots.length) saved.slots.forEach(addRow);
    else addRow();

    addBtn.addEventListener("click", ()=> addRow());

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const slots = $$(".slot", builder).map(r => ({
        day: $(".slot-day", r).value,
        start: $(".slot-start", r).value,
        end: $(".slot-end", r).value
      }));
      const profile = {
        name: form.name.value.trim(),
        location: form.location.value.trim(),
        skills: form.skills.value.trim(),
        slots
      };
      write("seekerProfile", profile);
      alert("Availability saved!");
      renderJobs();
    });

    const readJobs = () => read("jobs", []);

    const slotMatches = (jobSlots, seekerSlots) => {
      // if any job slot overlaps with any seeker slot on same day => match
      for (const js of jobSlots){
        for (const ss of seekerSlots){
          if (js.day === ss.day && timeOverlap(js.start, js.end, ss.start, ss.end)){
            return true;
          }
        }
      }
      return false;
    };

    const renderJobs = () => {
      jobList.innerHTML = "";
      const profile = read("seekerProfile", {slots:[]});
      const jobs = readJobs();

      const query = (searchTitle.value || "").toLowerCase();
      const maxDist = parseFloat(maxDistance.value || "NaN");

      const filtered = jobs.filter(j=>{
        const titleOk = !query || j.title.toLowerCase().includes(query);
        const distOk = Number.isNaN(maxDist) || (j.distance ?? Infinity) <= maxDist;
        const matchOk = slotMatches(j.slots || [], profile.slots || []);
        return titleOk && distOk && matchOk;
      });

      if (!filtered.length){
        emptyState.style.display = "block";
        return;
      }
      emptyState.style.display = "none";

      for (const j of filtered){
        const el = document.createElement("article");
        el.className = "job";
        el.innerHTML = `
          <h4>${j.title}</h4>
          <div class="meta">
            <span class="chip">${j.business}</span>
            <span class="chip">${j.location}</span>
            <span class="chip">₹${j.pay ?? "-"} / hr</span>
            <span class="chip">${(j.distance ?? "?")} km</span>
            <span class="chip">${(j.seats ?? 1)} seat(s)</span>
          </div>
          <p>${j.description || ""}</p>
          <div class="meta">
            ${(j.slots||[]).map(s=>`<span class="chip">${s.day} ${s.start}–${s.end}</span>`).join("")}
          </div>
          <div class="actions" style="margin-top:.5rem">
            <button class="btn btn-mint apply">Apply</button>
          </div>
        `;
        $(".apply", el).addEventListener("click", ()=>{
          // store application
          const apps = read("applications", []);
          apps.push({ jobId: j.id, at: Date.now(), seekerName: profile.name || "Student" });
          write("applications", apps);
          alert("Application submitted!");
        });
        jobList.appendChild(el);
      }
    };

    refreshBtn.addEventListener("click", renderJobs);
    searchTitle.addEventListener("input", renderJobs);
    maxDistance.addEventListener("input", renderJobs);
    renderJobs();
  };

  // ----------------------------------------- PROVIDER
  const initProvider = () => {
    nowYear();

    const form = $("#jobForm");
    const builder = $("#jobSlots");
    const addBtn = $("#addJobSlotBtn");
    const list = $("#providerJobList");
    const empty = $("#providerEmpty");

    const removeRow = (row) => row.remove();
    const addRow = (slot) => {
      const r = makeSlotRow(removeRow);
      if (slot){
        $(".slot-day", r).value = slot.day;
        $(".slot-start", r).value = slot.start;
        $(".slot-end", r).value = slot.end;
      }
      builder.appendChild(r);
    };
    if ($$(".slot", builder).length === 0) addRow();

    addBtn.addEventListener("click", ()=> addRow());

    form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const slots = $$(".slot", builder).map(r => ({
        day: $(".slot-day", r).value,
        start: $(".slot-start", r).value,
        end: $(".slot-end", r).value
      }));

      const job = {
        id: crypto.randomUUID(),
        business: form.business.value.trim(),
        location: form.location.value.trim(),
        title: form.title.value.trim(),
        description: form.description.value.trim(),
        slots,
        pay: parseFloat(form.pay.value || "0"),
        distance: parseFloat(form.distance.value || "NaN"),
        seats: parseInt(form.seats.value || "1", 10)
      };

      const jobs = read("jobs", []);
      jobs.unshift(job);
      write("jobs", jobs);

      alert("Job published!");
      form.reset();
      builder.innerHTML = "";
      addRow();
      renderProviderJobs();
    });

    const renderProviderJobs = () => {
      list.innerHTML = "";
      const jobs = read("jobs", []);
      if (!jobs.length){ empty.style.display = "block"; return; }
      empty.style.display = "none";

      const apps = read("applications", []);

      for (const j of jobs){
        // count applications for this job
        const count = apps.filter(a => a.jobId === j.id).length;

        const el = document.createElement("article");
        el.className = "job";
        el.innerHTML = `
          <h4>${j.title}</h4>
          <div class="meta">
            <span class="chip">${j.business}</span>
            <span class="chip">${j.location}</span>
            <span class="chip">₹${j.pay ?? "-"} / hr</span>
            <span class="chip">${(j.distance ?? "?")} km</span>
            <span class="chip">${(j.seats ?? 1)} seat(s)</span>
            <span class="chip">Applications: ${count}</span>
          </div>
          <p>${j.description || ""}</p>
          <div class="meta">
            ${(j.slots||[]).map(s=>`<span class="chip">${s.day} ${s.start}–${s.end}</span>`).join("")}
          </div>
          <div class="actions" style="margin-top:.5rem">
            <button class="btn btn-ghost remove">Delete</button>
          </div>
        `;
        $(".remove", el).addEventListener("click", ()=>{
          const updated = jobs.filter(x => x.id !== j.id);
          write("jobs", updated);
          renderProviderJobs();
        });
        list.appendChild(el);
      }
    };

    $("#refreshProviderJobs").addEventListener("click", renderProviderJobs);
    renderProviderJobs();
  };

  // expose
  return { initSeeker, initProvider };
})();

// common: set footer year on any page load
document.addEventListener("DOMContentLoaded", ()=>{
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

