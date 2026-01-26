(function(){
  // Manage Tags modal integration for view media page
  // Expects window.DCSMHUB.mediaToken and window.DCSMHUB.isEditor

  const MEDIA_TOKEN = (window.DCSMHUB && window.DCSMHUB.mediaToken) || null;
  const IS_EDITOR = (window.DCSMHUB && window.DCSMHUB.isEditor) || false;
  if(!MEDIA_TOKEN) return;

  // minimal CSS injection for modal (keeps template edits small)
  // Styles moved to `static/css/media_manage_tags.css` for easier editing.

  // create modal DOM
  const modal = document.createElement('div');
  modal.className = 'mt-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="mt-header"><strong>Manage Tags for Media</strong><button id="mtCloseBtn">✖</button></div>
    <div class="mt-body">
      <div class="tag-picker">
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="mtTagInput" type="text" placeholder="type or choose a suggestion..." style="flex:1;padding:8px;border:1px solid #cfcfcf;border-radius:4px">
          <button id="mtAddBtn" class="secondary">Add</button>
        </div>
        <div id="mtSuggestions" class="suggestions-dropdown" aria-hidden="true"><div id="mtSuggestionsRow" style="display:flex;flex-wrap:wrap"></div></div>
      </div>

      <div class="section"><h4>Currently assigned tags</h4><div id="mtAssignedTags" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div></div>
      <div class="section"><h4>Staged to add</h4><div id="mtStagedAdd" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
      <h4 style="margin-top:12px">Staged to remove</h4><div id="mtStagedRemove" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div></div>

      <div class="controls"><button id="mtApplyBtn" class="primary">Apply changes</button><button id="mtCancelBtn" class="secondary">Cancel</button><div id="mtStatus" style="margin-left:auto;color:#777;font-size:13px">No changes staged</div></div>
    </div>
  `;
  document.body.appendChild(modal);

  // create backdrop to enforce modal behavior (prevent clicks behind)
  const backdrop = document.createElement('div');
  backdrop.className = 'mt-backdrop';
  backdrop.setAttribute('aria-hidden','true');
  backdrop.style.display = 'none';
  document.body.appendChild(backdrop);

  // refs
  const tagInput = modal.querySelector('#mtTagInput');
  const suggestionsEl = modal.querySelector('#mtSuggestions');
  const suggestionsRow = modal.querySelector('#mtSuggestionsRow');
  const assignedTagsEl = modal.querySelector('#mtAssignedTags');
  const stagedAddEl = modal.querySelector('#mtStagedAdd');
  const stagedRemoveEl = modal.querySelector('#mtStagedRemove');
  const addBtn = modal.querySelector('#mtAddBtn');
  const applyBtn = modal.querySelector('#mtApplyBtn');
  const cancelBtn = modal.querySelector('#mtCancelBtn');
  const statusEl = modal.querySelector('#mtStatus');
  const closeBtn = modal.querySelector('#mtCloseBtn');

  let allTags = [];
  let assigned = [];
  let stagedAdd = [];
  let stagedRemove = [];
  const dcYearRegex = /^dc\d{4}$/i;
  // Protect any tag that begins with "dc" (case-insensitive) from being removed via this modal.
  function isProtectedTag(title){
    if(!title) return false;
    try{ return /^dc/i.test(title.toString()); }catch(e){ return false; }
  }
  // Returns a list of unique dcYYYY prefixes (lowercased) assigned to this media
  function getAssignedDcPrefixes(){
    try{
      const prefixes = assigned
        .map(t=>{ const m = (t && t.title && t.title.match(/^dc\d{4}/i)); return m ? m[0].toLowerCase() : null; })
        .filter(Boolean);
      // unique
      return [...new Set(prefixes)];
    }catch(e){ return []; }
  }
  let _mtKeydownHandler = null;

  // csrf helper
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
  const csrftoken = getCookie('csrftoken');

  function updateStatus(){
    if(stagedAdd.length===0 && stagedRemove.length===0) statusEl.textContent='No changes staged';
    else statusEl.textContent = `${stagedAdd.length} to add, ${stagedRemove.length} to remove`;
  }

  function renderAssigned(){
    assignedTagsEl.innerHTML='';
    assigned.forEach(t=>{
      const el = document.createElement('div');
      el.className='tag-pill';
      el.textContent = t.title;
      // If this tag is protected (starts with 'dc'), do not render a remove control.
      if(!isProtectedTag(t.title)){
        const x = document.createElement('span');
        x.style.marginLeft='8px'; x.style.cursor='pointer'; x.textContent='✖'; x.title='Stage to remove';
        x.addEventListener('click', ()=>{
          stageRemove(t);
        });
        el.appendChild(x);
      }else{
        // show a subtle lock indicator so users know the tag cannot be removed here
        const lock = document.createElement('span');
        lock.style.marginLeft='8px'; lock.style.opacity='0.6'; lock.textContent='🔒'; lock.title='Protected tag (cannot be removed here)';
        el.appendChild(lock);
      }
      assignedTagsEl.appendChild(el);
    });
  }

  function renderStaged(){
    stagedAddEl.innerHTML=''; stagedAdd.forEach(t=>{
      const el = document.createElement('div'); el.className='tag-pill'; el.textContent=t.title;
      const x = document.createElement('span'); x.style.marginLeft='8px'; x.style.cursor='pointer'; x.textContent='✖'; x.title='Remove from staged add';
      x.addEventListener('click', ()=>{ stagedAdd = stagedAdd.filter(x=>x.title!==t.title); renderStaged(); updateStatus(); });
      el.appendChild(x); stagedAddEl.appendChild(el);
    });
    stagedRemoveEl.innerHTML=''; stagedRemove.forEach(t=>{
      const el = document.createElement('div'); el.className='tag-pill'; el.textContent=t.title;
      const x = document.createElement('span'); x.style.marginLeft='8px'; x.style.cursor='pointer'; x.textContent='✖'; x.title='Remove from staged remove';
      x.addEventListener('click', ()=>{ stagedRemove = stagedRemove.filter(x=>x.title!==t.title); renderStaged(); updateStatus(); });
      el.appendChild(x); stagedRemoveEl.appendChild(el);
    });
  }

  function stageAdd(tag){
    if(assigned.find(t=>t.title.toLowerCase()===tag.title.toLowerCase())) return; // already assigned
    if(stagedAdd.find(t=>t.title.toLowerCase()===tag.title.toLowerCase())) return;
    stagedRemove = stagedRemove.filter(x=>x.title.toLowerCase()!==tag.title.toLowerCase());
    stagedAdd.push(tag);
    renderStaged(); updateStatus();
  }

  function stageRemove(tag){
    // Prevent staging removal of protected tags
    if(isProtectedTag(tag.title)){
      console.warn('Attempt to stage removal of protected tag', tag.title);
      return;
    }
    // tag is object with title
    stagedAdd = stagedAdd.filter(x=>x.title.toLowerCase()!==tag.title.toLowerCase());
    if(!stagedRemove.find(x=>x.title.toLowerCase()===tag.title.toLowerCase())) stagedRemove.push(tag);
    renderStaged(); updateStatus();
  }

  function renderSuggestions(list){
    suggestionsRow.innerHTML='';
    if(!list||list.length===0){ suggestionsEl.style.display='none'; suggestionsEl.setAttribute('aria-hidden','true'); return; }
    suggestionsEl.style.display='block'; suggestionsEl.setAttribute('aria-hidden','false');
    list.forEach(tag=>{
      const btn = document.createElement('button'); btn.type='button'; btn.className='tag-pill'; btn.textContent = tag.title;
      btn.addEventListener('click', ()=>{ stageAdd(tag); tagInput.value=''; suggestionsEl.style.display='none'; });
      suggestionsRow.appendChild(btn);
    });
  }

  function filterTags(q){
    const norm = (q||'').toLowerCase().trim(); if(norm==='') return [];
    // Exclude any tag that starts with 'dc' from suggestions
    return allTags.filter(t=>{
      const title = (t && t.title) ? t.title : '';
      if(/^dc/i.test(title)) return false;
      return title.toLowerCase().includes(norm);
    }).slice(0,40);
  }

  // show a short list of all tags (excluding dcYYYY tags) when input is focused
  function showAllSuggestions(){
    const listFn = ()=>{
      // show non-dc tags only
      const list = allTags.filter(t=>{ const title=(t&&t.title)?t.title:''; return !/^dc/i.test(title); });
      renderSuggestions(list.slice(0,40));
    };
    if(allTags.length===0){ loadAllTags().then(listFn).catch(()=>{ renderSuggestions([]); }); }
    else listFn();
  }

  // fetch all tags once
  function loadAllTags(){
    return fetch('/api/v1/tags')
      .then(r=>{ if(!r.ok) throw new Error('failed to load tags'); return r.json(); })
      .then(data=>{
        // TagList returns paginated structure: {count, next, previous, results}
        if(Array.isArray(data)) allTags = data; else if(data.results) allTags = data.results; else allTags = data;
        return allTags;
      }).catch(e=>{ console.warn('Could not load tags', e); return []; });
  }

  function loadAssigned(){
    return fetch(`/api/v1/media/${MEDIA_TOKEN}/tags`)
      .then(r=>{ if(!r.ok) throw new Error('failed to load assigned tags'); return r.json(); })
      .then(data=>{ assigned = data || []; renderAssigned(); }).catch(e=>{ console.warn('Could not load media tags', e); assigned = []; renderAssigned(); });
  }

  // wire events
  let typingTimer = null;
  // open suggestions showing many tags when the input receives focus or clicked
  tagInput.addEventListener('focus', (e)=>{ showAllSuggestions(); });
  tagInput.addEventListener('click', (e)=>{ showAllSuggestions(); });
  tagInput.addEventListener('input', (e)=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{
      const q = e.target.value;
      if(!q||q.trim()===''){
        // when input is emptied, show a short list of all suggestions
        showAllSuggestions();
        return;
      }
      if(allTags.length===0){ loadAllTags().then(()=>{ const matches = filterTags(q); renderSuggestions(matches); }); }
      else { const matches = filterTags(q); renderSuggestions(matches); }
    }, 140);
  });

  addBtn.addEventListener('click', ()=>{
    const text = tagInput.value.trim(); if(!text) return;
    // find exact
    let exact = allTags.find(t=>t.title.toLowerCase()===text.toLowerCase());
    if(exact) stageAdd(exact); else stageAdd({title:text});
    tagInput.value=''; renderSuggestions([]);
  });

  document.addEventListener('click', (ev)=>{ const within = ev.target.closest && ev.target.closest('.tag-picker'); if(!within) suggestionsEl.style.display='none'; });

  applyBtn.addEventListener('click', ()=>{
    // send POST to manage_tags
    if(!IS_EDITOR){ alert('Only editors can apply tag changes'); return; }
    const adds = stagedAdd.map(t=>t.title);
    // ensure protected tags are not included in the removal payload
    const removes = stagedRemove.map(t=>t.title).filter(title=>!isProtectedTag(title));
    const payload = { add: adds, remove: removes };
    fetch(`/api/v1/media/${MEDIA_TOKEN}/manage_tags`, {
      method: 'POST', headers: { 'Content-Type':'application/json', 'X-CSRFToken': csrftoken }, body: JSON.stringify(payload)
    }).then(r=>{
      if(!r.ok) throw new Error('apply failed'); return r.json();
    }).then(data=>{
      // update assigned from response if present
      if(data && data.tags) assigned = data.tags; else loadAssigned();
      stagedAdd = []; stagedRemove = []; renderAssigned(); renderStaged(); updateStatus();
      // ask the user to acknowledge success then reload page so UI reflects changes
      alert('Changes applied');
      try{ window.location.reload(); }catch(e){ closeModal(); }
    }).catch(e=>{ console.error(e); alert('Failed to apply changes'); });
  });

  cancelBtn.addEventListener('click', ()=>{ stagedAdd = []; stagedRemove = []; renderStaged(); updateStatus(); closeModal(); });
  closeBtn.addEventListener('click', ()=>{ closeModal(); });

  function openModal(){
    // show backdrop first to block clicks behind the modal
    backdrop.style.display = 'block';
    modal.style.display = 'block';
    // lock body scroll while modal is open
    try{ document._mtPrevBodyOverflow = document.body.style.overflow || ''; document.body.style.overflow = 'hidden'; }catch(e){}
    // load tags and assigned
    loadAllTags();
    loadAssigned();
    // attach escape key handler to allow closing the modal via keyboard
    try{
      _mtKeydownHandler = function(ev){ if(ev.key==='Escape' || ev.key==='Esc' || ev.keyCode===27){ ev.preventDefault(); closeModal(); } };
      document.addEventListener('keydown', _mtKeydownHandler);
    }catch(e){}
  }
  function closeModal(){
    modal.style.display='none';
    try{ backdrop.style.display = 'none'; }catch(e){}
    try{ document.body.style.overflow = document._mtPrevBodyOverflow || ''; }catch(e){}
    try{ if(_mtKeydownHandler){ document.removeEventListener('keydown', _mtKeydownHandler); _mtKeydownHandler = null; } }catch(e){}
    // return focus to opener if present
    try{ const openerEl = document.getElementById('manageTagsBtn'); if(openerEl) openerEl.focus(); }catch(e){}
  }

  // Attach opener helper
  function attachOpener(el){
    if(!el) return;
    if(el.__manageTagsAttached) return;
    el.addEventListener('click', (e)=>{ e.preventDefault(); openModal(); });
    el.__manageTagsAttached = true;
  }

  const existingOpener = document.getElementById('manageTagsBtn');
  if(existingOpener) attachOpener(existingOpener);

  // If the page renders the button dynamically, insert it into the
  // `.media-author-actions` container when it appears. Only insert for editors.
  if(IS_EDITOR){
    function createAndInsertButton(container){
      if(!container) return;
      const already = container.querySelector('#manageTagsBtn');
      if(already){ attachOpener(already); return; }
      const btn = document.createElement('a');
      btn.href = '#';
      btn.id = 'manageTagsBtn';
      // match existing edit button styling by reusing the `edit-media` class
      btn.className = 'edit-media';
      btn.title = 'Manage tags';
      btn.textContent = 'MANAGE TAGS';
      btn.style.marginLeft = '8px';
      attachOpener(btn);
      container.appendChild(btn);
    }

    // immediate attempt (in case the dynamic content already rendered)
    const nowContainer = document.querySelector('.media-author-actions');
    if(nowContainer) createAndInsertButton(nowContainer);

    // observe the document for dynamic insertion of the container
    const observer = new MutationObserver((mutations)=>{
      for(const m of mutations){
        for(const node of m.addedNodes){
          try{
            if(!(node instanceof HTMLElement)) continue;
            if(node.matches && node.matches('.media-author-actions')){ createAndInsertButton(node); return; }
            const c = node.querySelector && node.querySelector('.media-author-actions');
            if(c) { createAndInsertButton(c); return; }
          }catch(e){ /* ignore */ }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // small timeout fallback for frameworks that mutate an existing container
    setTimeout(()=>{
      const c = document.querySelector('.media-author-actions');
      if(c) createAndInsertButton(c);
    }, 800);
  }

})();

