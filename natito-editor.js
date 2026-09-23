'use strict';

/* Editor de natito · conserva los documentos y el contenido existente.
   Los borradores solo viven en este navegador. Publicar requiere guardar. */
(() => {
  if (window.__natitoEditorBooted) return;
  window.__natitoEditorBooted = true;
  const C = window.PageContent;
  const clone = C.clone;
  let data, remote = {}, dialog, body, footer, current = null, section = '', busy = false, generation = 0;
  let loaded = false;
  const sections = [
    ['home','♡','Mi espacio'], ['welcome','✉','Bienvenida'], ['letters','♥','Cartas principales'],
    ['pins','⌘','Claves y pistas'], ['questions','?','Preguntas Sí / No'], ['cards','❀','Cartas ocultas'],
    ['story','☷','Mini historia'], ['history','↕','Ordena la historia'], ['emotional','☺','Quiz emocional'],
    ['puzzle','▦','Rompecabezas'], ['moments','▧','Nuestros momentos'], ['album','▣','Álbum de fotos'],
    ['notes','✎','Cartas y notas'], ['music','♫','Canciones'], ['preview','◉','Ver pantallas'], ['backup','↓','Copia del contenido']
  ];
  const welcomeKeys = ['welcomeTitle','welcomeHint','welcomePrimary','welcomePrimarySub','welcomeSecondary','welcomeSecondarySub','welcomeNote'];
  const letterKeys = ['finalLetterTitle','finalLetter','letterTitle','letterSubtitle','letterIntro','footerQuote'];
  const pinKeys = ['lockTitle','lockSubtitle',...Object.keys(C.fields).filter(k => k.startsWith('hint'))];
  const allowed = () => (window.auth?.currentUser?.email || '').toLowerCase() === USERNAME_TO_EMAIL.natito;
  function node(tag, props = {}, ...children) {
    const n = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on')) n.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'className') n.className = value;
      else if (key in n && !['role','list','form'].includes(key)) n[key] = value;
      else n.setAttribute(key, value);
    }
    children.flat().forEach(child => { if (child != null) n.append(child.nodeType ? child : document.createTextNode(String(child))); });
    return n;
  }
  const button = (text, action, cls = 'ne-button') => node('button', { type: 'button', className: cls, onclick: action }, text);
  const message = (text, cls = '') => node('p', { className: 'ne-hint ' + cls }, text);
  function status(text, bad = false) {
    const target = dialog?.querySelector('#ne-status');
    if (target) { target.textContent = text; target.classList.toggle('ne-error', bad); }
  }
  function draftKey(key) { return `natito-draft-v3:${window.auth.currentUser.uid}:${key}`; }
  function readDraft(key) { try { return JSON.parse(localStorage.getItem(draftKey(key))); } catch (_) { return null; } }
  function clearDraft(key) { try { localStorage.removeItem(draftKey(key)); } catch (_) {} }
  function persistDraft() {
    if (!current || busy) return;
    try {
      const value = current.collect(false);
      if (JSON.stringify(value) === current.baseline) { clearDraft(current.key); return; }
      localStorage.setItem(draftKey(current.key), JSON.stringify({ value, savedAt: Date.now() }));
      status('Borrador en este dispositivo · aún no publicado');
    } catch (error) { status('No se pudo conservar el borrador. Mantén el editor abierto.', true); }
  }
  function errorText(error) {
    if (error.code === 'permission-denied') return 'Tu cuenta no tiene permiso para guardar esta sección. Revisa las reglas de Firebase.';
    if (error.code === 'unavailable') return 'No hay conexión con Firebase. Tu borrador sigue aquí; vuelve a intentar.';
    return error.message || 'No se pudo guardar. Tu borrador sigue aquí.';
  }
  function assertEditor() {
    if (!allowed()) throw new Error('Solo natito puede editar esta página.');
    if (!loaded) throw new Error('Primero vuelve a cargar el contenido guardado.');
    if (!navigator.onLine) throw new Error('Estás sin conexión. Tu borrador sigue en este dispositivo.');
  }
  async function commit(patch) {
    assertEditor();
    if (new Blob([JSON.stringify(patch)]).size > 750000) throw new Error('El contenido es demasiado grande. Reduce el texto antes de guardar.');
    const ref = window.db.collection('editor_data').doc('content');
    // Comprobar únicamente los campos que se editan, para no pisar otra sesión.
    const paths = Object.entries(patch).flatMap(([key,value]) => key === 'textos' ? Object.keys(value).map(k => ['textos', k]) : [[key]]);
    const at = (obj, path) => path.reduce((a,k) => a?.[k], obj);
    let fresh;
    await window.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      fresh = snap.exists ? snap.data() : {};
      for (const path of paths) {
        if (JSON.stringify(at(fresh,path)) !== JSON.stringify(at(remote,path))) {
          throw new Error('Esta sección cambió en otra sesión. Conservamos tu borrador: usa “Recargar contenido” y revisa los cambios antes de guardar.');
        }
      }
      tx.set(ref, patch, { merge: true });
    });
    remote = { ...fresh, ...patch, textos: { ...fresh.textos, ...patch.textos } };
    data = { ...data, ...remote, textos: { ...data.textos, ...remote.textos } };
    window._editableContent = remote;
    C.apply(remote);
    if (patch.preguntas) window.reiniciarSiNo();
    if (patch.storyLines && document.getElementById('story-screen').classList.contains('active')) window.initStory();
    if (patch.historyPhrases && document.getElementById('sort-screen').classList.contains('active')) window.initSortGame();
    if (patch.emojiQuiz && document.getElementById('equiz-screen').classList.contains('active')) window.initEmotionalQuiz();
  }
  function open() {
    if (!allowed()) return;
    if (!dialog) {
      const nav = node('nav', { className: 'ne-nav', 'aria-label': 'Secciones del editor' });
      sections.forEach(([id,icon,label]) => nav.append(button(icon + '  ' + label, () => showSection(id), 'ne-nav-item ne-nav-' + id)));
      body = node('div', { className: 'ne-body', id: 'ne-body' });
      footer = node('footer', { className: 'ne-footer' });
      const heading = node('header', { className: 'ne-header' }, node('div', {}, node('p', { className: 'eyebrow' }, 'HECHO CON AMOR'), node('h2', { id: 'ne-title' }, 'El rincón de natito')), button('×', close, 'ne-close'));
      heading.querySelector('button').setAttribute('aria-label', 'Cerrar editor');
      dialog = node('dialog', { id: 'natito-editor-modal', className: 'ne-dialog', 'aria-labelledby': 'ne-title' }, heading,
        node('div', { className: 'ne-layout' }, nav, node('main', { className: 'ne-main' }, body, footer)));
      document.body.append(dialog);
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
      dialog.addEventListener('input', persistDraft);
      dialog.addEventListener('change', persistDraft);
      dialog.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
      });
    }
    if (!dialog.open) dialog.showModal();
    showSection('home');
  }
  function close() {
    if (busy) { status('Espera a que termine el guardado.'); return; }
    persistDraft(); dialog.close(); current = null;
    document.getElementById('natito-edit-btn')?.focus();
  }
  function clearBody(title, hint) {
    current = null; body.replaceChildren(node('h3', {}, title));
    if (hint) body.append(message(hint));
    footer.replaceChildren(node('p', { id: 'ne-status', role: 'status', 'aria-live': 'polite' }, 'Los cambios se publican al guardar.'));
    body.scrollTop = 0;
  }
  function field(parent, label, value = '', type = 'text') {
    const wrap = node('label', { className: 'ne-field' }, node('span', { className: 'ne-label' }, label));
    const input = type === 'textarea' ? node('textarea', { value, rows: 4 }) : node('input', { value, type });
    wrap.append(input); parent.append(wrap); return () => input.value;
  }
  function richField(parent, label, value = '') {
    const wrap = node('div', { className: 'ne-field ne-rich-wrap' });
    const toolbar = node('div', { className: 'ne-toolbar', role: 'toolbar', 'aria-label': 'Formato de ' + label });
    const edit = node('div', { className: 'ne-rich', contentEditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label, spellcheck: true });
    edit.innerHTML = C.sanitize(value);
    const count = node('span', { className: 'ne-count' });
    const updateCount = () => { count.textContent = `${edit.textContent.trim().length} caracteres`; };
    let range = null;
    function remember() { const sel = getSelection(); if (sel.rangeCount && edit.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange(); }
    edit.addEventListener('keyup', remember); edit.addEventListener('mouseup', remember); edit.addEventListener('input', () => { remember(); updateCount(); });
    function command(name, arg = null) {
      edit.focus();
      if (range && edit.contains(range.commonAncestorContainer)) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); }
      // Conserva el historial nativo de deshacer de contenteditable.
      document.execCommand(name, false, arg); remember(); updateCount(); persistDraft();
    }
    const commands = [['B','Negrita','bold'],['I','Cursiva','italic'],['U','Subrayado','underline'],['S̶','Tachado','strikeThrough'],['• Lista','Lista con viñetas','insertUnorderedList'],['1. Lista','Lista numerada','insertOrderedList'],['≡','Alinear a la izquierda','justifyLeft'],['☰','Centrar','justifyCenter'],['↶','Deshacer','undo'],['↷','Rehacer','redo'],['Tx','Quitar formato','removeFormat']];
    commands.forEach(([text,title,cmd]) => {
      const b = button(text, () => command(cmd), 'ne-tool'); b.title = title; b.setAttribute('aria-label',title);
      b.addEventListener('mousedown', e => e.preventDefault()); toolbar.append(b);
    });
    const format = node('select', { 'aria-label': 'Estilo de párrafo' });
    [['div','Texto'],['h3','Subtítulo'],['blockquote','Cita']].forEach(([v,t]) => format.append(node('option',{value:v},t)));
    format.addEventListener('change', () => command('formatBlock', format.value)); toolbar.append(format);
    const palette = node('select', { 'aria-label': 'Color del texto' });
    [['#3d1a28','Tinta'],['#c9184a','Rosa'],['#7a3854','Malva']].forEach(([v,t]) => palette.append(node('option',{value:v},t)));
    palette.addEventListener('change', () => { command('styleWithCSS', true); command('foreColor', palette.value); }); toolbar.append(palette);
    const preview = node('div', { className: 'ne-rich ne-rich-preview', hidden: true });
    const toggle = button('Vista previa', () => {
      preview.hidden = !preview.hidden; edit.hidden = !preview.hidden; toolbar.hidden = !preview.hidden;
      if (!preview.hidden) preview.innerHTML = C.sanitize(edit.innerHTML);
      toggle.textContent = preview.hidden ? 'Vista previa' : 'Seguir editando';
    }, 'ne-text-button');
    edit.addEventListener('paste', event => {
      event.preventDefault();
      const html = event.clipboardData.getData('text/html');
      if (html) command('insertHTML', C.sanitize(html));
      else command('insertText', event.clipboardData.getData('text/plain'));
    });
    edit.addEventListener('drop', event => event.preventDefault());
    wrap.append(node('div',{className:'ne-field-heading'},node('span',{className:'ne-label'},label),toggle),toolbar,edit,preview,count);
    parent.append(wrap); updateCount();
    return () => C.sanitize(edit.innerHTML);
  }
  function formSection(key, title, initial, render, onSave, hint = 'Edita con calma. Puedes cerrar el editor y recuperar tu borrador aquí.') {
    clearBody(title,hint);
    const form = node('div', { className: 'ne-form' });
    body.append(form);
    const build = value => { form.replaceChildren(); return render(form, clone(value)); };
    current = { key, collect: build(initial), baseline: JSON.stringify(initial), onSave };
    current.baseline = JSON.stringify(current.collect(false));
    const draft = readDraft(key);
    if (draft && JSON.stringify(draft.value) !== current.baseline) {
      const banner = node('div',{className:'ne-draft'},message('Tienes un borrador de esta sección.'),
        button('Recuperar borrador',() => { current.collect=build(draft.value);banner.remove();status('Borrador recuperado · revísalo antes de guardar.'); }),
        button('Descartar borrador',() => { clearDraft(key);banner.remove(); },'ne-text-button'));
      body.insertBefore(banner,form);
    }
    footer.append(node('div',{className:'ne-actions'},
      button('Revertir cambios',() => { current.collect=build(initial);clearDraft(key);body.querySelector('.ne-draft')?.remove();status('Volviste a la versión guardada.'); },'ne-soft'),
      button('Guardar cambios',save,'ne-primary')));
  }
  async function save() {
    if (!current || busy) return;
    const active = current;
    persistDraft();
    try {
      assertEditor();
      const value = active.collect(true);
      busy = true; dialog.classList.add('ne-saving'); status('Guardando…');
      await active.onSave(value);
      clearDraft(active.key);
      active.baseline = JSON.stringify(value);
      // Reabrir desde el estado confirmado mantiene Revertir en la última versión.
      busy = false; await showSection(section, false);
      status('✓ Cambios guardados. Ya se ven en la página.');
    } catch (error) { status(errorText(error), true); }
    finally { busy = false; dialog.classList.remove('ne-saving'); }
  }
  function textForm(keys, title) {
    const initial = Object.fromEntries(keys.map(k => [k,data.textos[k] || '']));
    formSection(section,title,initial,(form,values) => {
      const getters = keys.map(key => [key,(C.fields[key][2] === 'rich' ? richField : field)(form,C.fields[key][1],values[key])]);
      return () => Object.fromEntries(getters.map(([key,get]) => [key,get()]));
    },values => commit({textos:values}));
  }
  // Filas reutilizables: mover nunca recrea los campos ni pierde lo escrito.
  function listFields(parent, initial, renderRow, emptyRow, min = 1, fixed = false) {
    const list = node('div',{className:'ne-list'}); parent.append(list);
    function add(value) {
      const row = node('section',{className:'ne-row'}), content = node('div',{className:'ne-row-fields'});
      row._get = renderRow(content,value);
      const tools = node('div',{className:'ne-row-tools'});
      if (!fixed) {
        tools.append(button('↑',()=> { if(row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);renumber();persistDraft(); },'ne-tool'),
          button('↓',()=> { if(row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);renumber();persistDraft(); },'ne-tool'),
          button('Duplicar',()=> { add(row._get(false));persistDraft(); },'ne-tool'),
          button('Quitar',()=> { if(list.children.length<=min){status(`Conserva al menos ${min} elemento(s).`,true);return;} row.remove();renumber();persistDraft(); },'ne-tool ne-danger'));
        tools.children[0].setAttribute('aria-label','Mover arriba'); tools.children[1].setAttribute('aria-label','Mover abajo');
      }
      row.append(node('p',{className:'ne-row-number'}),tools,content);list.append(row);renumber();
      return row;
    }
    function renumber(){[...list.children].forEach((row,i) => row.querySelector('.ne-row-number').textContent = String(i+1).padStart(2,'0'));}
    initial.forEach(add);
    if(!fixed) parent.append(button('+ Agregar',()=>{const row=add(clone(emptyRow));row.querySelector('input,textarea')?.focus();persistDraft();},'ne-add'));
    return validate => [...list.children].map(row=>row._get(validate));
  }
  function required(value, label, validate) { if(validate && !String(value).trim()) throw new Error(`Completa ${label}; no se ha eliminado ningún elemento.`); return value; }
  function simpleList(key,title,initial) {
    formSection(key,title,initial,(form,values) => listFields(form,values,(row,value) => {
      const get = field(row,'Texto',typeof value === 'string' ? value : value.text,'textarea');
      return validate => required(get(),'todos los textos',validate);
    },''),values => commit({[key]:key==='historyPhrases' ? values.map((text,i)=>({id:i+1,text})) : values}));
  }
  async function readCollection(name) {
    const snapshot = await window.db.collection(name).get();
    return snapshot.docs.slice().sort((a,b)=>(b.data().fecha?.toMillis?.() || 0)-(a.data().fecha?.toMillis?.() || 0));
  }
  async function collectionSave(collection,id,original,patch) {
    assertEditor();
    const ref=window.db.collection(collection).doc(id);
    await window.db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new Error('Este elemento ya no existe. Vuelve a cargar la lista.');
      for(const key of Object.keys(patch)) if(key!=='formato' && JSON.stringify(snap.data()[key])!==JSON.stringify(original[key]))throw new Error('Este elemento cambió en otra sesión. Recarga la lista antes de guardar.');
      tx.update(ref,patch);
    });
  }
  async function manageCollection(kind, token) {
    const name = {album:'fotos',notes:'cartas',music:'musica'}[kind];
    const title = {album:'Álbum de fotos',notes:'Cartas y notas',music:'Nuestras canciones'}[kind];
    clearBody(title,'Tus elementos se conservan. Abre uno para editarlo.');
    body.append(button(kind==='album'?'+ Subir una foto':kind==='notes'?'+ Escribir una carta':'+ Agregar canción',()=>{
      if(kind==='album'){close();window.goToMainLetter();window.showTab('panel',document.getElementById('tab-btn-panel'));document.getElementById('photo-upload-input').focus();}
      else editDocument(kind,null,{});
    },'ne-primary'));
    const loading=message('Cargando…');body.append(loading);
    try {
      const docs=await readCollection(name);
      if(token!==generation)return;
      loading.remove();
      const search=node('input',{className:'ne-search',type:'search',placeholder:'Buscar…','aria-label':'Buscar en '+title});body.append(search);
      const list=node('div',{className:'ne-collection'});body.append(list);
      if(!docs.length)list.append(message('Todavía no hay elementos guardados.'));
      docs.forEach(doc=>{
        const value=doc.data();
        const row=node('article',{className:'ne-collection-row'});
        const label=value.titulo || value.nombre || value.descripcion || 'Foto sin descripción';
        const desc=node('div',{},node('strong',{},label));
        if(kind==='album'){
          const url=C.safeURL(value.url || value.imageUrl || value.photoURL || value.src || value.downloadURL,true);
          row.append(node('img',{src:url,alt:label,loading:'lazy'}));
        } else if(kind==='notes'){
          const temp=document.createElement('div'); temp.innerHTML=C.sanitize(value.formato==='html'?value.contenido:'');
          desc.append(message((value.formato==='html'?temp.textContent:value.contenido || '').slice(0,150)));
        }
        row.append(desc,button('Editar',()=>editDocument(kind,doc.id,value),'ne-soft'));
        list.append(row);row.dataset.search=(label+' '+(value.contenido || '')).toLowerCase();
      });
      search.addEventListener('input',()=>list.querySelectorAll('article').forEach(row=>row.hidden=!row.dataset.search.includes(search.value.toLowerCase())));
    }catch(error){loading.textContent=errorText(error);loading.classList.add('ne-error');}
  }
  function plainToHTML(text){const div=document.createElement('div');div.textContent=text || '';return div.innerHTML.replace(/\n/g,'<br>');}
  function editDocument(kind,id,original) {
    const name={album:'fotos',notes:'cartas',music:'musica'}[kind];
    const key=`${kind}:${id || 'new'}`;
    let initial;
    if(kind==='notes')initial={titulo:original.titulo || '',contenido:original.formato==='html'?original.contenido:plainToHTML(original.contenido),formato:'html'};
    if(kind==='album')initial={descripcion:original.descripcion || original.description || original.caption || ''};
    if(kind==='music')initial={nombre:original.nombre || '',url:original.url || ''};
    formSection(key,kind==='notes'?'Tu cartita':kind==='album'?'Editar recuerdo':'Editar canción',initial,(form,values)=>{
      if(kind==='notes'){
        const title=field(form,'Título',values.titulo),content=richField(form,'Tu carta',values.contenido);
        return validate=>{
          const titulo=required(title(),'el título',validate),contenido=content();
          const text=document.createElement('div');text.innerHTML=contenido;
          required(text.textContent,'el contenido de la carta',validate);
          return {titulo,contenido,formato:'html'};
        };
      }
      if(kind==='album'){
        form.append(node('img',{className:'ne-photo-preview',src:C.safeURL(original.url || original.imageUrl || original.photoURL || original.src || original.downloadURL,true),alt:'Foto del álbum'}));
        const get=field(form,'Descripción',values.descripcion,'textarea');return ()=>({descripcion:get()});
      }
      const title=field(form,'Nombre',values.nombre),url=field(form,'Enlace de Spotify',values.url,'url');
      return validate=>{
        if(validate && !/^https:\/\/open\.spotify\.com\/(?:intl-[^/]+\/)?(?:embed\/)?(track|album|playlist|episode|artist)\/[a-zA-Z0-9]+(?:[?/#].*)?$/.test(url().trim()))throw new Error('Pega un enlace válido de Spotify.');
        return {nombre:required(title(),'el nombre',validate),url:url().trim()};
      };
    },async values=>{
      if(id)await collectionSave(name,id,original,values);
      else await window.db.collection(name).add({...values,fecha:firebase.firestore.FieldValue.serverTimestamp(),autor:window._currentUsername});
      await ({album:window.loadDynamicAlbum,notes:window.loadDynamicCartas,music:window.loadDynamicMusica}[kind])();
    });
    const back=button('← Volver a la lista',()=>showSection(kind),'ne-text-button');body.insertBefore(back,body.firstChild);
    if(id)body.append(button('Eliminar este elemento…',()=>{
      const confirmBox=node('div',{className:'ne-delete-confirm'},message('¿Eliminar este elemento? Esta acción no se puede deshacer.'),
        button('Sí, eliminar',async()=>{
          if(busy)return;
          try{assertEditor();busy=true;await window.db.collection(name).doc(id).delete();clearDraft(key);current=null;
            await ({album:window.loadDynamicAlbum,notes:window.loadDynamicCartas,music:window.loadDynamicMusica}[kind])();
            busy=false;await showSection(kind,false);status('Elemento eliminado.');
          }catch(error){status(errorText(error),true);}finally{busy=false;}
        },'ne-danger ne-button'),button('Conservarlo',()=>confirmBox.remove(),'ne-soft'));
      body.querySelector('.ne-delete-confirm')?.remove();body.append(confirmBox);
    },'ne-text-button ne-danger'));
  }
  async function showSection(id, keepDraft = true) {
    if(busy){status('Espera a que termine el guardado.');return;}
    if(keepDraft)persistDraft();
    section=id;const token=++generation;
    dialog.querySelectorAll('.ne-nav-item').forEach(el=>{const active=el.classList.contains('ne-nav-'+id);el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');});
    if(!loaded && id!=='home'){clearBody('No se pudo cargar el contenido','Vuelve a Mi espacio y pulsa Recargar contenido.');return;}
    if(id==='home'){
      clearBody('Todo lo que hiciste, con tu toque.','Elige una sección. Tus cartas, notas y recuerdos siguen en su lugar.');
      if(!loaded)body.append(message('No pudimos leer los cambios guardados. Recarga antes de editar para conservarlos.','ne-error'));
      const cards=node('div',{className:'ne-home-grid'});
      [['letters','💌','Escribir con amor','Formato, párrafos y vista previa.'],['questions','✨','Personalizar el recorrido','Preguntas, historias y sorpresas.'],['album','📷','Cuidar los recuerdos','Fotos y descripciones del álbum.'],['notes','📝','Mis cartas y notas','Crear y editar cada cartita.']].forEach(([target,icon,title,desc])=>{
        const card=button('',()=>showSection(target),'ne-home-card');card.append(node('span',{className:'ne-home-icon'},icon),node('strong',{},title),message(desc));cards.append(card);
      });body.append(cards,message('Atajo: Ctrl + S o ⌘ + S para guardar. Los borradores se conservan solo en este dispositivo.'),button('Recargar contenido',async()=>{
        persistDraft();try{await load(true);await showSection('home');status('Contenido actualizado. Tus borradores se conservan.');}catch(e){status(errorText(e),true);}
      },'ne-soft'));
    } else if(id==='welcome')textForm(welcomeKeys,'Una bienvenida para ella');
    else if(id==='letters')textForm(letterKeys,'Las cartas principales');
    else if(id==='pins'){
      const initial={pin:data.pin,skipPin:data.skipPin,textos:Object.fromEntries(pinKeys.map(k=>[k,data.textos[k]]))};
      formSection(id,'Claves y pistas',initial,(form,values)=>{
        form.append(message('Son dos claves distintas: la del recorrido y la del acceso directo a la carta.'));
        const getPin=field(form,'PIN del candado del recorrido',values.pin),getSkip=field(form,'Clave para ir directo a la carta',values.skipPin);
        form.querySelectorAll('input').forEach(input=>{input.inputMode='numeric';input.maxLength=4;input.autocomplete='off';});
        const getters=pinKeys.map(key=>[key,richField(form,C.fields[key][1],values.textos[key])]);
        return validate=>{
          if(validate && (!/^\d{4}$/.test(getPin()) || !/^\d{4}$/.test(getSkip())))throw new Error('Cada clave debe tener exactamente 4 números. Se permiten ceros al inicio.');
          return {pin:getPin(),skipPin:getSkip(),textos:Object.fromEntries(getters.map(([key,get])=>[key,get()]))};
        };
      },commit);
    } else if(id==='questions')formSection(id,'Preguntas Sí / No',data.preguntas,(form,values)=>listFields(form,values,(row,q)=>{
      const get=field(row,'Pregunta',q.pregunta,'textarea');
      const select=node('select',{'aria-label':'Respuesta correcta'},node('option',{value:'si'},'Sí'),node('option',{value:'no'},'No'));select.value=q.respuestaCorrecta;row.append(node('label',{className:'ne-field'},node('span',{className:'ne-label'},'Respuesta correcta'),select));
      return validate=>({...q,pregunta:required(get(),'cada pregunta',validate),respuestaCorrecta:select.value});
    },{pregunta:'',respuestaCorrecta:'si'}),values=>commit({preguntas:values}));
    else if(id==='cards')formSection(id,'Las cinco cartas ocultas',data.flipCards,(form,values)=>listFields(form,values,(row,card)=>{
      const icon=field(row,'Emoji',card.icono),title=field(row,'Título',card.titulo),text=field(row,'Mensaje',card.texto,'textarea');
      return validate=>({icono:icon() || '💌',titulo:required(title(),'los títulos',validate),texto:required(text(),'los mensajes',validate)});
    },{},5,true),values=>commit({flipCards:values}));
    else if(id==='story')simpleList('storyLines','La mini historia',data.storyLines);
    else if(id==='history')simpleList('historyPhrases','Nuestra historia, en el orden correcto',data.historyPhrases);
    else if(id==='emotional')formSection(id,'Quiz emocional',data.emojiQuiz,(form,values)=>listFields(form,values,(row,q)=>{
      const title=field(row,'Pregunta',q.pregunta,'textarea');
      const options=listFields(row,q.opciones,(inner,opt)=>{const text=field(inner,'Opción',opt.texto),reply=field(inner,'Tu respuesta a esta opción',opt.resp,'textarea');return validate=>({texto:required(text(),'cada opción',validate),resp:required(reply(),'cada respuesta',validate)});},{texto:'',resp:''},2);
      return validate=>({pregunta:required(title(),'cada pregunta',validate),opciones:options(validate)});
    },{pregunta:'',opciones:[{texto:'',resp:''},{texto:'',resp:''}]}),values=>commit({emojiQuiz:values}));
    else if(id==='moments')formSection(id,'Nuestros momentos',data.moments,(form,values)=>listFields(form,values,(row,item)=>{
      const getURL=field(row,'Ruta o enlace de la foto',item.url),getCaption=field(row,'Descripción',item.descripcion,'textarea');
      row.append(node('img',{className:'ne-photo-preview',src:C.safeURL(item.url,true),alt:item.descripcion}));
      return validate=>{if(validate&&!C.safeURL(getURL(),true))throw new Error('Revisa el enlace de cada foto.');return {url:getURL(),descripcion:getCaption()};};
    },{},data.moments.length,true),values=>commit({moments:values}));
    else if(id==='puzzle'){
      formSection(id,'La foto del rompecabezas',{puzzleImage:data.puzzleImage},(form,values)=>{
        const get=field(form,'Ruta o enlace de imagen',values.puzzleImage);
        const img=node('img',{className:'ne-photo-preview',src:C.safeURL(values.puzzleImage,true),alt:'Foto del rompecabezas'});form.append(img);
        const input=form.querySelector('input');input.addEventListener('input',()=>{img.src=C.safeURL(input.value,true);});
        const grid=node('div',{className:'ne-photo-picker'});form.append(message('O elige una de tus fotos del álbum:'),grid);
        readCollection('fotos').then(docs=>{if(!grid.isConnected)return;docs.forEach(doc=>{const photo=doc.data();const url=C.safeURL(photo.url || photo.imageUrl || photo.photoURL || photo.src || photo.downloadURL,true);if(!url)return;const b=button('',()=>{input.value=url;img.src=url;persistDraft();},'ne-photo-choice');b.append(node('img',{src:url,alt:photo.descripcion || 'Usar esta foto',loading:'lazy'}));grid.append(b);});if(!docs.length)grid.append(message('Aún no hay fotos subidas.'));}).catch(error=>grid.append(message(errorText(error),'ne-error')));
        return validate=>{if(validate&&!C.safeURL(get(),true))throw new Error('Escribe una ruta o enlace de imagen válido.');return {puzzleImage:get()};};
      },commit);
    } else if(['album','notes','music'].includes(id))await manageCollection(id,token);
    else if(id==='preview'){
      clearBody('Recorre tu página','Puedes visitar cualquier pantalla. La vista previa no envía respuestas por correo.');
      const names={'welcome-screen':'Bienvenida','lock-screen':'Candado','questions-screen':'Preguntas','memory-screen':'Memoria','sort-screen':'Ordena la historia','equiz-screen':'Quiz emocional','cards-screen':'Cartas ocultas','puzzle-screen':'Rompecabezas','story-screen':'Mini historia','final-letter-screen':'Carta final','letter-screen':'Carta principal'};
      Object.entries(names).forEach(([screen,label])=>body.append(button('Ver '+label,()=>{close();window._editorPreview=true;if(screen==='questions-screen')window.reiniciarSiNo();window.goToPhase(screen);if(screen==='final-letter-screen')window.animateFinalLetter();if(screen==='letter-screen'){window.showTab('carta',document.getElementById('tab-btn-carta'));window.initScrollReveal();}},'ne-preview-link')));
    } else if(id==='backup'){
      clearBody('Una copia de tus palabras','Descarga el contenido editable y las referencias a cartas, fotos y canciones. Las fotos y la música no se incluyen como archivos.');
      body.append(button('Descargar copia del contenido',async()=>{
        try{
          const [fotos,cartas,musica]=await Promise.all(['fotos','cartas','musica'].map(readCollection));
          const exportDoc=docs=>docs.map(doc=>({id:doc.id,...doc.data()}));
          const blob=new Blob([JSON.stringify({version:3,fecha:new Date().toISOString(),content:data,fotos:exportDoc(fotos),cartas:exportDoc(cartas),musica:exportDoc(musica)},null,2)],{type:'application/json'});
          const url=URL.createObjectURL(blob),link=node('a',{href:url,download:'nuestros-recuerdos-'+new Date().toISOString().slice(0,10)+'.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);status('Copia descargada.');
        }catch(error){status(errorText(error),true);}
      },'ne-primary'));
    }
  }
  async function load(force = false) {
    const base = data || C.defaults();
    if(force || !window._editableContent || window._editableContentError){const snap=await window.db.collection('editor_data').doc('content').get();remote=snap.exists?snap.data():{};window._editableContentError=null;}
    else remote=clone(window._editableContent);
    data={...base,...remote,textos:{...base.textos,...remote.textos}};
    window._editableContent=remote;C.apply(remote);loaded=true;
  }
  window.initNatitoEditor = async () => {
    if(!allowed())return;
    try{await load();}catch(error){loaded=false;console.warn('Editor:',error.code || error.message);}
    if(!document.getElementById('natito-edit-btn')){
      const trigger=button('✎',open,'natito-edit-trigger');trigger.id='natito-edit-btn';trigger.title='Abrir el editor de natito';trigger.setAttribute('aria-label','Abrir el editor de natito');document.body.append(trigger);
    }
    if(!document.getElementById('natito-quiz-nav')){
      const nav=node('div',{id:'natito-quiz-nav',className:'ne-quiz-nav'},button('← Anterior',()=>window.natitoQuizPrev(),'ne-soft'),button('Siguiente →',()=>window.natitoQuizNext(),'ne-soft'));
      document.getElementById('questions-screen').append(nav);
    }
  };
  function inspectQuestion(direction){
    if(!allowed())return;
    window._editorPreview=true;
    const state=window.state;
    state.qIndex=Math.max(0,Math.min(window.preguntas.length-1,state.qIndex+direction));
    const result=document.getElementById('q-resultado');result.classList.remove('active');result.style.display='none';
    document.getElementById('q-sinno').style.display='block';window.renderSiNoQuestion();
  }
  window.natitoQuizPrev=()=>inspectQuestion(-1);
  window.natitoQuizNext=()=>inspectQuestion(1);
  window.openNatitoEditor=open;
  // Compatibilidad con accesos existentes y atajos desde la consola del autor.
  Object.entries({openEditorWelcome:'welcome',openEditorTextos:'letters',openEditorFinalLetter:'letters',openEditorLetterIntro:'letters',openEditorPin:'pins',openEditorLockTexts:'pins',openEditorPreguntas:'questions',openEditorFlipCards:'cards',openEditorStory:'story',openEditorPuzzle:'puzzle',openEditorAlbum:'album',openEditorNotas:'notes',openEditorSkip:'preview'}).forEach(([name,id])=>{window[name]=()=>{open();if(allowed())showSection(id);};});
  window.addEventListener('beforeunload',event=>{persistDraft();if(busy){event.preventDefault();event.returnValue='';}});
})();
