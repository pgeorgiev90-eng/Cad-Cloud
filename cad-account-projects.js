(() => {
    const button = document.getElementById('save-account-project');
    const status = document.getElementById('account-project-status');
    const editor = button.dataset.editor;
    const solar = editor === 'solar';
    button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = 'Проверка на акаунта…';
        try {
            const sessionResponse = await fetch('api/account-draft.php?action=session', {cache:'no-store'});
            if (!sessionResponse.ok) throw Error('unavailable');
            const session = await sessionResponse.json();
            if (!session.user) {
                const login = document.createElement('a');
                login.href = 'auth.html';
                login.target = '_blank';
                login.rel = 'noopener';
                login.textContent = 'Влез в акаунта';
                status.replaceChildren(login, ' и натисни отново „Запази в акаунта“.');
                return;
            }
            const project = solar ? window.PDGSolarEditor?.project() : window.PDGCad?.project();
            const name = document.getElementById(solar ? 'project-name' : 'project')?.value.trim() || '';
            if (!name || !project || (solar && !project.planes.length)) {
                status.textContent = 'Въведи име и подготви проекта за запис.';
                return;
            }
            if (!window.confirm('Записаното копие на проекта ще бъде достъпно за администраторите на PDG Systems. Да се запази ли?')) {
                status.textContent = '';
                return;
            }
            status.textContent = 'Записване…';
            const response = await fetch('api/cad-projects.php', {
                method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},
                body:JSON.stringify({editor,name,project})
            });
            if (!response.ok) throw Error(response.status === 413 ? 'large' : 'unavailable');
            status.textContent = 'Проектът е записан в акаунта.';
        } catch (error) {
            status.textContent = error.message === 'large' ? 'Проектът е твърде голям. Използвай JSON експорт.' : 'Записът в акаунта не успя. Опитай отново.';
        } finally {
            button.disabled = false;
        }
    });
})();
