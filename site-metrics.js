(() => {
    const cookie = 'pdg_statistics';
    const preference = () => document.cookie.split('; ').find(value => value.startsWith(cookie + '='))?.split('=')[1];
    const params = new URLSearchParams(location.search);
    const page = location.pathname.split('/').pop();
    let source = 'direct';
    function track(event, item = '') {
        if (preference() !== 'yes') return;
        fetch('api/site-metrics.php', {
            method: 'POST', keepalive: true,
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({event, source, item})
        }).catch(() => {});
    }
    function pageEvents() {
        const campaign = (params.get('utm_source') || '').toLowerCase();
        let referrer;
        try { referrer = new URL(document.referrer); } catch {}
        const external = referrer && referrer.origin !== location.origin;
        const host = external ? referrer.hostname : '';
        let saved;
        try { saved = sessionStorage.getItem('pdg_metrics_source'); } catch {}
        const known = campaign === 'google' || /(^|\.)google\.(com|bg|[a-z]{2})$/.test(host) ? 'google' :
            ['facebook','fb'].includes(campaign) || /(^|\.)facebook\.com$/.test(host) ? 'facebook' :
            external || campaign ? 'other' : '';
        source = known || saved || 'direct';
        try { sessionStorage.setItem('pdg_metrics_source', source); } catch {}
        if (!saved) track('visit');
        if (page === 'roof-cad.php') track('solar_cad');
        if (page === 'electrical-cad.php') track('electric_cad');
        if (page === 'catalog.html' || page === 'shop.html') track('category', params.get('section') || params.get('type') || 'all');
        const product = params.get('id') || '';
        if (page === 'product.html' && /^[1-9][0-9]{0,9}$/.test(product)) track('product', product);
    }
    window.PDGTrack = track;
    document.addEventListener('click', event => {
        if (event.target.closest('a[href^="tel:"]')) track('phone');
    });

    const panel = document.createElement('section');
    panel.className = 'pdg-cookie-panel';
    panel.setAttribute('aria-label','Настройки за бисквитки');
    panel.hidden = !!preference();
    panel.innerHTML = '<strong>Настройки за бисквитки</strong><p>Необходимите бисквитки поддържат входа и количката. С разрешение събираме обобщена статистика за посещения, CAD, магазина и контактите.</p><div><button type="button" data-choice="no">Само необходимите</button><button type="button" data-choice="yes">Разреши статистика</button></div>';
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'pdg-cookie-settings';
    settings.textContent = 'Бисквитки';
    settings.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) panel.querySelector('button').focus();
    });
    panel.addEventListener('click', event => {
        const choice = event.target.dataset.choice;
        if (!choice) return;
        const previous = preference();
        document.cookie = cookie + '=' + choice + '; Max-Age=15552000; Path=/; Secure; SameSite=Lax';
        panel.hidden = true;
        settings.focus();
        if (choice === 'no') {
            try { sessionStorage.removeItem('pdg_metrics_source'); } catch {}
        } else if (previous !== 'yes') pageEvents();
    });
    document.body.append(settings, panel);
    if (preference() === 'yes') pageEvents();
})();
