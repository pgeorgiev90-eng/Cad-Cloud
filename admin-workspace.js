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
    async function enquiries() {
        detail.textContent = 'Зареждане на запитванията…';
        try {
            const data = await request('view=enquiries');
            if (!data.enquiries.length) {
                detail.textContent = 'Още няма запитвания.';
                return;
            }
            for (const enquiry of data.enquiries) {
                const label = enquiry.source === 'site' ? 'Сайт' : 'Electric CAD';
                const button = make('button', label + ' · ' + enquiry.customer_name);
                button.type = 'button';
                button.setAttribute('aria-pressed','false');
                button.addEventListener('click', () => {
                    for (const item of inbox.children) item.setAttribute('aria-pressed',String(item === button));
                    detail.replaceChildren(
                        make('h3',enquiry.project_name),
                        make('p',[enquiry.customer_name,enquiry.email,enquiry.phone].filter(Boolean).join(' · ')),
                        make('p',enquiry.created_at + ' · № ' + enquiry.public_ref)
                    );
                    if (enquiry.message) detail.append(make('p',enquiry.message));
                    if (enquiry.source === 'electric') {
                        const link = make('a','Отвори материалите и цените');
                        link.href = 'admin-electric.html';
                        detail.append(link);
                    }
                });
                inbox.append(button);
            }
            inbox.firstElementChild.click();
        } catch {
            detail.textContent = 'Запитванията не могат да се заредят.';
        }
    }
    form.addEventListener('submit',event => {
        event.preventDefault();
        page = 1;
        projects();
    });
    back.addEventListener('click',() => {page--;projects();});
    next.addEventListener('click',() => {page++;projects();});
    function start() {projects();enquiries();}
    if (element('app').hidden) window.addEventListener('pdg-admin-ready',start,{once:true});
    else start();
})();
