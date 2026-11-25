import { App } from './app/App.js';

let bootPromise = null;

function setBootStatus(text) {
    document.querySelectorAll('.loading-status').forEach((el) => { el.textContent = text; });
    document.documentElement.style.setProperty('--blazor-load-percentage', '100%');
}

function hideBootOverlay() {
    document.documentElement.classList.add('scene-ready');
    document.querySelectorAll('.boot-overlay').forEach((overlay) => {
        overlay.classList.add('is-done');
    });
}

window.initSignalGenerator = () => {
    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
        setBootStatus('Инициализация сцены...');
        try {
            await new App().boot();
        } catch (err) {
            console.error('Не удалось загрузить сцену', err);
            setBootStatus('Ошибка загрузки сцены');
        }
        hideBootOverlay();
    })();

    return bootPromise;
};
