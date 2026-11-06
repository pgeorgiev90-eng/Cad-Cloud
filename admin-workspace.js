(() => {
    const element = id => document.getElementById(id);
    const form = element('pdg-project-filters');
    const rows = element('pdg-project-list');
    const status = element('pdg-project-status');
    const back = element('pdg-project-back');
    const next = element('pdg-project-next');
    const inbox = element('pdg-inbox-list');
    const detail = element('pdg-inbox-detail');
    const make = (tag,text) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        return node;
    };
    async function request(query) {
        const response = await fetch('api/cad-projects.php?' + query, {cache:'no-store'});
        if (!response.ok) throw Error('unavailable');
        return response.json();
    }
    let page = 1;
    let sequence = 0;
    async function projects() {
        const id = ++sequence;
        back.disabled = next.disabled = true;
        status.textContent = 'Зареждане…';
        const query = new URLSearchParams(new FormData(form));
        query.set('page', page);
        try {
            const data = await request(query);
            if (id !== sequence) return;
            rows.replaceChildren();
            for (const project of data.projects) {
                const row = make('tr');
                for (const value of [project.project_name,project.email,project.editor === 'solar' ? 'Solar CAD' : 'Electric CAD',project.updated_at]) row.append(make('td',value));
                const actions = make('td');
                const download = make('button','JSON');
                download.type = 'button';
                download.setAttribute('aria-label','Изтегли ' + project.project_name);
                download.addEventListener('click', async () => {
                    download.disabled = true;
                    try {
                        const record = await request(new URLSearchParams({id:project.id}));
                        const url = URL.createObjectURL(new Blob([JSON.stringify(record.project,null,2)],{type:'application/json'}));
                        const link = make('a');
                        link.href = url;
                        link.download = 'pdg-' + project.editor + '-' + project.id + '.json';
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url),1000);
                    } catch {
                        status.textContent = 'Копието на проекта не може да бъде изтеглено.';
                    } finally {
                        download.disabled = false;
                    }
                });
                actions.append(download);
                row.append(actions);
                rows.append(row);
            }
            status.textContent = data.projects.length ? 'Страница ' + page : 'Няма намерени проекти.';
            back.disabled = page <= 1;
            next.disabled = !data.more;
        } catch {
            if (id !== sequence) return;
            rows.replaceChildren();
            status.textContent = 'Проектите не могат да се заредят.';
            back.disabled = page <= 1;
        }
    }
    const inboxApi = 'api/enquiry-inbox.php';
    let selected = '';
    function unreadCount(count) {
        element('pdg-inbox-count').textContent = '(' + count + ' непрочетени)';
        element('pdg-inbox-nav-count').textContent = count ? '(' + count + ')' : '';
    }
    async function enquiries() {
        const refresh = element('pdg-inbox-refresh');
        refresh.disabled = true;
        if (!selected) detail.textContent = 'Зареждане на запитванията…';
        try {
            const response = await fetch(inboxApi, {cache:'no-store'});
            if (!response.ok) throw Error('unavailable');
            const data = await response.json();
            unreadCount(data.unread);
            inbox.replaceChildren();
            detail.textContent = data.enquiries.length ? 'Изберете запитване, за да го прочетете.' : 'Още няма запитвания.';
            function show(enquiry) {
                detail.replaceChildren(
                    make('h3', enquiry.project_name),
                    make('p', [enquiry.customer_name,enquiry.email,enquiry.phone].filter(Boolean).join(' · ')),
                    make('p', enquiry.created_at + ' · № ' + enquiry.public_ref)
                );
                if (enquiry.message) detail.append(make('p', enquiry.message));
                if (enquiry.source === 'electric') {
                    const link = make('a', 'Отвори материалите и цените');
                    link.href = 'admin-electric.html';
                    detail.append(link);
                }
            }
            for (const enquiry of data.enquiries) {
                const label = (enquiry.source === 'site' ? 'Сайт' : 'Electric CAD') + ' · ' + enquiry.customer_name;
                const button = make('button', enquiry.unread ? 'Непрочетено · ' + label : label);
                button.type = 'button';
                button.dataset.unread = String(enquiry.unread);
                button.setAttribute('aria-pressed', String(selected === enquiry.public_ref));
                if (selected === enquiry.public_ref) show(enquiry);
                button.addEventListener('click', async () => {
                    selected = enquiry.public_ref;
                    for (const item of inbox.children) item.setAttribute('aria-pressed',String(item === button));
                    show(enquiry);
                    if (!enquiry.unread) return;
                    for (const item of inbox.children) item.disabled = true;
                    refresh.disabled = true;
                    try {
                        const read = await fetch(inboxApi, {
                            method:'POST',
                            headers:{'Content-Type':'application/json','X-CSRF-Token':data.csrf},
                            body:JSON.stringify({reference:enquiry.public_ref})
                        });
                        if (!read.ok) throw Error('unavailable');
                        unreadCount((await read.json()).unread);
                        enquiry.unread = false;
                        button.dataset.unread = 'false';
                        button.textContent = label;
                    } catch {
                        if (selected === enquiry.public_ref) detail.append(make('p', 'Запитването остава непрочетено. Опитайте отново.'));
                    } finally {
                        for (const item of inbox.children) item.disabled = false;
                        refresh.disabled = false;
                        button.focus();
                    }
                });
                inbox.append(button);
            }
        } catch {
            detail.textContent = 'Запитванията не могат да се заредят.';
        } finally {
            refresh.disabled = false;
        }
    }
    const metricsLabels = {
        visit:'Посещения',phone:'Кликове върху телефона',enquiry:'Изпратени запитвания',
        solar_cad:'Отваряния на Solar CAD',electric_cad:'Отваряния на Electric CAD',
        registration:'Потвърдени регистрации',category:'Прегледи на категории',
        product:'Прегледи на продукти',cart_add:'Добавяния в количката'
    };
    async function siteMetrics() {
        const target = element('pdg-metrics-status');
        try {
            const response = await fetch('api/admin-site-metrics.php', {cache:'no-store'});
            if (!response.ok) throw Error('unavailable');
            const data = await response.json();
            element('pdg-metrics-events').replaceChildren(...Object.entries(metricsLabels).map(([event,label]) => {
                const row = make('tr');
                const heading = make('th',label);
                heading.scope = 'row';
                const counts = ['google','facebook','direct','other'].map(source =>
                    Number(data.events.find(metric => metric.event_name === event && metric.source === source)?.total || 0));
                row.append(heading, ...[counts.reduce((sum,value) => sum+value,0),...counts].map(value => make('td',value)));
                return row;
            }));
            const sections = window.PDGCatalogSections.sections;
            element('pdg-metrics-categories').replaceChildren(...data.categories.map(row =>
                make('li', (sections[row.item] || ({all:'Всички категории',solar:'Соларни категории'})[row.item] || row.item) + ' · ' + row.total)));
            element('pdg-metrics-products').replaceChildren(...data.products.map(row => make('li', row.name + ' · ' + row.total)));
            target.textContent = data.events.length ? '' : 'Още няма отчетени действия.';
        } catch {
            target.textContent = 'Статистиката за сайта временно не е достъпна.';
        }
    }
    form.addEventListener('submit',event => {
        event.preventDefault();
        page = 1;
        projects();
    });
    back.addEventListener('click',() => {page--;projects();});
    next.addEventListener('click',() => {page++;projects();});
    function start() {
        projects();
        enquiries();
        siteMetrics();
        element('pdg-inbox-refresh').addEventListener('click', enquiries);
        setInterval(() => {
            if (document.hidden) return;
            if (!element('pdg-inbox-refresh').disabled && !inbox.contains(document.activeElement)) enquiries();
            siteMetrics();
        }, 30000);
    }
    if (element('app').hidden) window.addEventListener('pdg-admin-ready',start,{once:true});
    else start();
})();
