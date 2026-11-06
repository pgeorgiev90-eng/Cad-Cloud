(() => {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('contactStatus');
    const button = form.querySelector('button[type="submit"]');
    let ticket;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        button.disabled = true;
        status.hidden = false;
        status.textContent = 'Изпращане…';
        try {
            if (!ticket) {
                const session = await fetch(form.action, {cache: 'no-store'});
                if (!session.ok) throw new Error();
                ticket = await session.json();
            }
            const payload = Object.fromEntries(new FormData(form));
            payload.request_key = ticket.request_key;
            const response = await fetch(form.action, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-CSRF-Token': ticket.csrf},
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                if (response.status === 403 || response.status === 409) ticket = null;
                if (response.status === 429) {
                    status.textContent = 'Изчакайте малко, преди да изпратите ново запитване.';
                    return;
                }
                throw new Error();
            }
            ticket = null;
            form.reset();
            if (response.status === 201) window.PDGTrack?.('enquiry');
            status.textContent = 'Запитването е получено. Номер: ' + result.reference;
        } catch {
            status.textContent = 'Не успяхме да потвърдим изпращането. Опитайте отново.';
        } finally {
            button.disabled = false;
        }
    });
})();
