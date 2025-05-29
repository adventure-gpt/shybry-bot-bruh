// ==UserScript==
// @name         Unified Befriender & Ovipets Bots with AI Egg Solver
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Befriender + Ovipets Auto‐Turn Eggs (single & across friends) with AI solver, retry on error, and no overlapping solves.
// @match        *://*.ovipets.com/*
// @grant        GM_xmlhttpRequest
// @connect      im*.ovipets.com
// @connect      127.0.0.1
// @connect      localhost
// @connect      ovipets.com
// ==/UserScript==

(function() {
    'use strict';

    // --- Befriender 1.6 ---
    const Befriender = (function() {
        const RUN_KEY   = 'befriender_running';
        const LINKS_KEY = 'befriender_links';
        const IDX_KEY   = 'befriender_index';
        const BASE_KEY  = 'befriender_base_href';

        function log(...args) {
            console.log('%c[BEFRIENDER]', 'background:#0055aa;color:#fff;', ...args);
        }
        function startBot() {
            sessionStorage.setItem(BASE_KEY, location.href);
            sessionStorage.setItem(RUN_KEY, 'true');
            sessionStorage.setItem(IDX_KEY, '0');
            sessionStorage.removeItem(LINKS_KEY);
            log('Started befriending');
            setTimeout(main, 500);
        }
        function stopBot() {
            sessionStorage.removeItem(RUN_KEY);
            log('Stopped befriending');
        }
        function isRunning() { return sessionStorage.getItem(RUN_KEY) === 'true'; }
        function getBase()   { return sessionStorage.getItem(BASE_KEY); }
        function getLinks()  { try { return JSON.parse(sessionStorage.getItem(LINKS_KEY))||[]; } catch { return []; } }
        function saveLinks(a){ sessionStorage.setItem(LINKS_KEY,JSON.stringify(a)); }
        function getIndex()  { return parseInt(sessionStorage.getItem(IDX_KEY)||'0',10); }
        function setIndex(i){ sessionStorage.setItem(IDX_KEY,String(i)); }

        function collectLinks() {
            log('Collecting avatar links');
            const xpath = '/html/body/div[1]/main/div/div/div/div/div[2]/section/div/form/fieldset[1]/div/ul';
            const ul = document.evaluate(xpath, document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
            if (!ul) { log('UL not found'); stopBot(); return; }
            const links = Array.from(ul.querySelectorAll('li>a.user.avatar')).map(a=>a.href);
            if (!links.length) { log('No links'); stopBot(); return; }
            saveLinks(links);
        }
        function goToProfile() {
            if (!isRunning()) return;
            const links = getLinks(), idx = getIndex();
            if (idx >= links.length) {
                log('All done');
                stopBot();
                location.href = getBase();
                return;
            }
            log(`Visiting ${idx+1}/${links.length}`);
            location.href = links[idx];
        }
        function handleProfile() {
            if (!isRunning()) return;
            let tries = 0;
            const sel = 'button[onclick*="friend_request"]';
            const iv = setInterval(()=>{
                const btn = document.querySelector(sel);
                if (btn) {
                    clearInterval(iv);
                    btn.click();
                    setIndex(getIndex()+1);
                    setTimeout(()=>location.href = getBase(), 1000);
                } else if (++tries > 2) {
                    clearInterval(iv);
                    setIndex(getIndex()+1);
                    setTimeout(goToProfile,500);
                }
            },500);
        }
        function main() {
            if (!isRunning()) return;
            const href = location.href, base = getBase();
            if (!sessionStorage.getItem(LINKS_KEY) && href===base) {
                collectLinks(); setTimeout(goToProfile,500);
            } else if (href===base) {
                setTimeout(goToProfile,500);
            } else {
                handleProfile();
            }
        }

        return { startBot, stopBot, main };
    })();


    // --- Ovipets Auto‐Turn Eggs (Single Profile) ---
    const OvipetsSingle = (function() {
        const RUN_KEY   = 'ovipets_single_running';
        const LINKS_KEY = 'ovipets_single_links';
        const IDX_KEY   = 'ovipets_single_index';
        const BASE_KEY  = 'ovipets_single_base';

        function log(...args) {
            console.log('%c[OVIPETS-SINGLE]', 'background:#222;color:#bada55;', ...args);
        }
        function startBot() {
            sessionStorage.setItem(RUN_KEY,'true');
            sessionStorage.setItem(BASE_KEY,location.href);
            sessionStorage.removeItem(LINKS_KEY);
            sessionStorage.setItem(IDX_KEY,'0');
            hideResume();
            log('Single bot started');
            main();
        }
        function stopBot() {
            sessionStorage.removeItem(RUN_KEY);
            log('Single bot stopped');
        }
        function resumeBot() {
            sessionStorage.setItem(RUN_KEY,'true');
            log('Single resumed');
            hideResume();
            stepIndex();
            navigateProfile();
        }
        function showResume() {
            const btn = document.getElementById('ovipets-single-resume');
            if (btn) btn.style.display='inline-block';
            const dlg = document.querySelector('div.ui-dialog[role="dialog"]');
            if (!dlg) return;
            const mo = new MutationObserver((_,o)=>{ o.disconnect(); setTimeout(resumeBot,800); });
            mo.observe(dlg,{attributes:true,attributeFilter:['style','class']});
        }
        function hideResume() {
            const btn = document.getElementById('ovipets-single-resume');
            if (btn) btn.style.display='none';
        }
        function isRunning() { return sessionStorage.getItem(RUN_KEY)==='true'; }
        function getLinks()  { try{ return JSON.parse(sessionStorage.getItem(LINKS_KEY))||[]; }catch{return [];} }
        function setLinks(a){ sessionStorage.setItem(LINKS_KEY,JSON.stringify(a)); }
        function getIndex()  { return parseInt(sessionStorage.getItem(IDX_KEY)||'0',10); }
        function setIndex(i){ sessionStorage.setItem(IDX_KEY,String(i)); }
        function getBase()   { return sessionStorage.getItem(BASE_KEY)||location.href; }

        function modalExists() {
            const dlg = document.querySelector('div.ui-dialog[role="dialog"]');
            if (!dlg) return false;
            const s = window.getComputedStyle(dlg);
            return s.display!=='none'&&s.visibility!=='hidden'&&dlg.offsetParent!==null;
        }

        function collectLinks() {
            if (!isRunning()) return;
            log('Collecting single eggs');
            window.scrollTo(0,document.body.scrollHeight);
            setTimeout(()=>{
                const imgs = Array.from(document.querySelectorAll('li div.right img[title="Turn Egg"]'));
                imgs.forEach(i=>{
                    if (i.closest('div.right').querySelector('img[title="Available"]')) i.remove();
                });
                const links = imgs.map(i=>i.closest('li').querySelector('a.pet')?.href).filter(Boolean);
                if (!links.length) { log('No eggs');stopBot();return; }
                setLinks(links);
                navigateProfile();
            },800);
        }

        function navigateProfile() {
            if (!isRunning()) return;
            const links = getLinks(), idx = getIndex();
            if (idx >= links.length) {
                log('Single done');
                stopBot();
                location.href = getBase();
                return;
            }
            log(`Single → egg ${idx+1}/${links.length}`);
            location.href = links[idx];
        }

        function stepIndex() {
            setIndex(getIndex()+1);
        }

        async function solveAndSubmitSingle() {
            const dlgSel  = 'div.ui-dialog[role="dialog"]';
            const turnSel = 'button[onclick*="pet_turn_egg"]';
            const maxRetries = 2;

            for (let attempt=1; attempt<=maxRetries; attempt++) {
                const dlg = document.querySelector(dlgSel);
                if (dlg) {
                    const img = dlg.querySelector('fieldset img');
                    const url = img.src.replace(/^\/\//,'https://');
                    log(`Attempt ${attempt}: fetching`,url);
                    const blob = await new Promise((res,rej)=>{
                        GM_xmlhttpRequest({
                            method:'GET',url,responseType:'blob',
                            onload:r=>res(r.response),onerror:e=>rej(e)
                        });
                    });
                    const form = new FormData();
                    form.append('file',blob,'egg.jpg');
                    log('Sending to AI API');
                    const resp = await fetch('http://127.0.0.1:8000/predict',{method:'POST',body:form});
                    var { predicted_class } = await resp.json();
                    if (attempt > 1) {
                        predicted_class = "Raptor/Vuples";
                    }
                    log('Predicted:',predicted_class);
                    Array.from(dlg.querySelectorAll('label')).forEach(lbl=>{
                        if (lbl.textContent.trim()===predicted_class) lbl.click();
                    });
                    dlg.querySelector('.ui-dialog-buttonpane button').click();
                    await new Promise(r=>setTimeout(r,800));

                    const errorDlg = Array.from(document.querySelectorAll(dlgSel))
                        .find(d=>d.querySelector('.ui-dialog-title')?.innerText==='Error');
                    if (errorDlg) {
                        log(`Wrong! retry ${attempt}/${maxRetries}`);
                        errorDlg.querySelector('.ui-dialog-buttonpane button').click();
                        document.querySelector(turnSel).click();
                        break;
                    }
                    break;
                }
            }

            log('Single moving on');
            stepIndex();
            navigateProfile();
        }

        function handleProfile() {
            if (!isRunning()) return;
            log('Single on profile');
            const sel = 'button[onclick*="pet_turn_egg"]';
            let tries = 0, max = 6;
            const clickTry = ()=>{
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.click();
                    // **async** callback so we await the solver and only then proceed
                    setTimeout(async ()=>{
                        const dlg = document.querySelector('div.ui-dialog[role="dialog"]');
                        if (dlg && /Name the Species/.test(dlg.innerHTML)) {
                            log('Single puzzle popped; solving via AI');
                            await solveAndSubmitSingle();
                        } else {
                            stepIndex();
                            navigateProfile();
                        }
                    },800);
                } else if (tries++ < max) {
                    setTimeout(clickTry,800);
                } else {
                    stepIndex();
                    navigateProfile();
                }
            };
            clickTry();
        }

        function main() {
            if (!isRunning()) return;
            const h = location.hash;
            if (h.includes('sub=profile') && h.includes('pet=')) {
                handleProfile();
            } else {
                collectLinks();
            }
        }

        return { startBot, stopBot, resumeBot, main };
    })();


    // --- Ovipets Auto‐Turn Eggs Across Friends ---
    const OvipetsAll = (function() {
        const RUN_KEY   = 'ovipets_running';
        const FR_KEY    = 'ovipets_friends';
        const FI_KEY    = 'ovipets_friend_index';
        const EG_KEY    = 'ovipets_eggs';
        const EI_KEY    = 'ovipets_egg_index';

        function log(...args) {
            console.log('%c[OVIPETS-ALL]', 'background:#222;color:#bada55;', ...args);
        }
        function startBot() {
            sessionStorage.setItem(RUN_KEY,'true');
            sessionStorage.removeItem(FR_KEY);
            sessionStorage.setItem(FI_KEY,'0');
            sessionStorage.removeItem(EG_KEY);
            sessionStorage.setItem(EI_KEY,'0');
            hideResume();
            main();
        }
        function stopBot() {
            sessionStorage.removeItem(RUN_KEY);
            log('All-bot stopped');
        }
        function resumeBot() {
            sessionStorage.setItem(RUN_KEY,'true');
            hideResume();
            stepEggIndex();
            navigateEggProfile();
        }
        function showResume() {
            const btn = document.getElementById('ovipets-all-resume');
            if (btn) btn.style.display='inline-block';
            const dlg = document.querySelector('div.ui-dialog[role="dialog"]');
            if (!dlg) return;
            const mo = new MutationObserver((_,o)=>{ o.disconnect(); setTimeout(resumeBot,800); });
            mo.observe(dlg,{attributes:true,attributeFilter:['style','class']});
        }
        function hideResume() {
            const btn = document.getElementById('ovipets-all-resume');
            if (btn) btn.style.display='none';
        }
        function isRunning() { return sessionStorage.getItem(RUN_KEY)==='true'; }
        function getFriends(){ try{return JSON.parse(sessionStorage.getItem(FR_KEY))||[];}catch{return [];} }
        function setFriends(a){ sessionStorage.setItem(FR_KEY,JSON.stringify(a)); }
        function getFI(){ return parseInt(sessionStorage.getItem(FI_KEY)||'0',10); }
        function setFI(i){ sessionStorage.setItem(FI_KEY,String(i)); log(`Friend index set to ${i}`); }
        function stepFI(){ setFI(getFI()+1); }
        function getEggs(){ try{return JSON.parse(sessionStorage.getItem(EG_KEY))||[];}catch{return [];} }
        function setEggs(a){ sessionStorage.setItem(EG_KEY,JSON.stringify(a)); }
        function getEI(){ return parseInt(sessionStorage.getItem(EI_KEY)||'0',10); }
        function setEI(i){ sessionStorage.setItem(EI_KEY,String(i)); }
        function stepEggIndex(){ setEI(getEI()+1); }

        function collectFriends() {
            if (!isRunning()) return;
            const ul = document.querySelector('body div#friends-list-modal ul')
                    ||document.querySelector('body div.friends-list ul')
                    ||document.querySelector('body ul');
            if (!ul) { stopBot(); return; }
            const friends = Array.from(ul.querySelectorAll('a.user.avatar'))
                                  .map(a=>a.href).filter(Boolean)
                                  .filter(h=>h!==window.location.origin+window.location.hash);
            setFriends(friends);
            navigateToNextFriend();
        }
        function navigateToNextFriend() {
    if (!isRunning()) return;

    const friends = getFriends();
    let idx = getFI();

    if (idx >= friends.length) {
        log('All friends done, restarting from the first friend');
        idx = 0;
        setFI(0);
    }

    const friendUrl = friends[idx];

    if (!friendUrl || typeof friendUrl !== 'string') {
        log(`Invalid friend URL at index ${idx}, skipping.`);
        stepFI();
        setTimeout(navigateToNextFriend, 500);
        return;
    }

    let url = friendUrl.replace('#!/', '#!/?src=pets&sub=hatchery&usr=');
    if (url.includes('&usr=?usr=')) {
        url = url.replace('&usr=?usr=', '&usr=');
    }
    location.href = url;
}

        function collectEggs(retries = 3) {
    if (!isRunning()) return;

    const attemptEggCollection = (attempt) => {
        window.scrollTo(0, document.body.scrollHeight);
        setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
            setTimeout(() => {
                const imgs = Array.from(document.querySelectorAll('li div.right img[title="Turn Egg"]'));
                const eggs = imgs.filter(i => !i.closest('div.right').querySelector('img[title="Available"]'))
                                 .map(i => i.closest('li').querySelector('a.pet')?.href)
                                 .filter(Boolean);

                if (!eggs.length && attempt < retries) {
                    log(`No eggs found on attempt ${attempt}, retrying...`);
                    attemptEggCollection(attempt + 1);
                } else if (!eggs.length) {
                    log('No eggs found after retries, moving to next friend.');
                    stepFI();
                    navigateToNextFriend();
                } else {
                    setEggs(eggs);
                    navigateEggProfile();
                }
            }, 500);  // Ensure ample time after midpoint scroll
        }, 500);  // Ensure ample time after scroll-to-bottom
    };

    attemptEggCollection(1);
}

        function navigateEggProfile() {
            if (!isRunning()) return;
            const eggs = getEggs(), idx = getEI();
            if (idx>=eggs.length) {
                stepFI(); navigateToNextFriend();
                return;
            }
            location.href = eggs[idx];
        }

        async function solveAndSubmitAll() {
    const dlgSel = 'div.ui-dialog[role="dialog"]';
    const turnSel = 'button[onclick*="pet_turn_egg"]';
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const dlg = document.querySelector(dlgSel);
        if (dlg) {
            const img = dlg.querySelector('fieldset img');
            const url = img.src.replace(/^\/\//, 'https://');
            log(`Attempt ${attempt}: fetching`, url);
            const blob = await new Promise((res, rej) => {
                GM_xmlhttpRequest({
                    method: 'GET', url, responseType: 'blob',
                    onload: r => res(r.response), onerror: e => rej(e)
                });
            });
            const form = new FormData();
            form.append('file', blob, 'egg.jpg');
            log('Sending to AI API');
            const resp = await fetch('http://127.0.0.1:8000/predict', { method: 'POST', body: form });
            const { predicted_class } = await resp.json();
            log('Predicted:', predicted_class);
            Array.from(dlg.querySelectorAll('label')).forEach(lbl => {
                if (lbl.textContent.trim() === predicted_class) lbl.click();
            });
            dlg.querySelector('.ui-dialog-buttonpane button').click();
            await new Promise(r => setTimeout(r, 1000));

            const errorDlg = Array.from(document.querySelectorAll(dlgSel))
                .find(d => d.querySelector('.ui-dialog-title')?.innerText === 'Error');
            if (errorDlg) {
                log(`Wrong! retry ${attempt}/${maxRetries}`);
                errorDlg.querySelector('.ui-dialog-buttonpane button').click();
                document.querySelector(turnSel).click();
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            break;
        } else {
            log('No dialog found, skipping solve');
        }
    }

    log('All moving on');
    stepEggIndex();

    // Force navigation after a slight delay
    setTimeout(() => {
        const previousURL = location.href;
        navigateEggProfile();

        // Additional check: If navigation didn't happen, force reload
        setTimeout(() => {
            if (location.href === previousURL) {
                log('Navigation stuck, forcing reload.');
                navigateEggProfile();
            }
        }, 1500);
    }, 500);
}

        function handleProfile() {
            if (!isRunning()) return;
            const sel = 'button[onclick*="pet_turn_egg"]';
            let tries=0, max=6;
            const clickTry = ()=>{
                const btn=document.querySelector(sel);
                if (btn) {
                    btn.click();
                    // **async** callback so we await solveAndSubmitAll() before any new solves
                    setTimeout(async ()=>{
                        const dlg = document.querySelector('div.ui-dialog[role="dialog"]');
                        if (dlg && /Name the Species/.test(dlg.innerHTML)) {
                            log('Puzzle popped; solving via AI');
                            await solveAndSubmitAll();
                        } else {
                            stepEggIndex();
                            navigateEggProfile();
                        }
                    },800);
                } else if (tries++<max) {
                    setTimeout(clickTry,800);
                } else {
                    stepEggIndex();
                    navigateEggProfile();
                }
            };
            clickTry();
        }

        function main() {
            if (!isRunning()) return;
            const h=location.hash||'';
            if (h.includes('sub=profile')&&h.includes('pet=')) {
                handleProfile();
            } else if (h.includes('sub=hatchery')) {
                collectEggs();
            } else {
                collectFriends();
            }
        }

        return { startBot, stopBot, resumeBot, main };
    })();


    // --- Unified Control Panel ---
    function injectUnifiedControls() {
        if (document.getElementById('unified-control')) return;
        const panel=document.createElement('div');
        panel.id='unified-control';
        Object.assign(panel.style,{
            position:'fixed',bottom:'20px',left:'20px',
            padding:'8px',background:'rgba(0,0,0,0.6)',
            color:'#fff',zIndex:9999,fontSize:'14px',borderRadius:'4px'
        });

        // Befriender
        const bef=document.createElement('div');
        bef.innerHTML=`<strong>Befriender</strong>
            <button>▶️ Start</button>
            <button>⏹️ Stop</button>`;
        bef.querySelector('button:first-of-type').onclick=Befriender.startBot;
        bef.querySelector('button:last-of-type').onclick=Befriender.stopBot;
        panel.append(bef);

        // Single
        const sin=document.createElement('div');
        sin.style.margin='8px 0';
        sin.innerHTML=`<strong>Ovipets Single</strong>
            <button>▶️ Start</button>
            <button>⏹️ Stop</button>
            <button id="ovipets-single-resume" style="display:none">⏯️ Resume</button>`;
        sin.querySelector('button:nth-of-type(1)').onclick=OvipetsSingle.startBot;
        sin.querySelector('button:nth-of-type(2)').onclick=OvipetsSingle.stopBot;
        sin.querySelector('#ovipets-single-resume').onclick=OvipetsSingle.resumeBot;
        panel.append(sin);

        // Across friends
        const all=document.createElement('div');
        all.innerHTML=`<strong>Ovipets Across</strong>
            <button>▶️ Start</button>
            <button>⏹️ Stop</button>
            <button id="ovipets-all-resume" style="display:none">⏯️ Resume</button>`;
        all.querySelector('button:nth-of-type(1)').onclick=OvipetsAll.startBot;
        all.querySelector('button:nth-of-type(2)').onclick=OvipetsAll.stopBot;
        all.querySelector('#ovipets-all-resume').onclick=OvipetsAll.resumeBot;
        panel.append(all);

        document.body.append(panel);
    }

    window.addEventListener('load', ()=>{
        injectUnifiedControls();
        Befriender.main();
        OvipetsSingle.main();
        OvipetsAll.main();
    });
    window.addEventListener('hashchange', ()=>{
        Befriender.main();
        OvipetsSingle.main();
        OvipetsAll.main();
    });

})();
