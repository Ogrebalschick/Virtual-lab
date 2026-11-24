import { esc } from './format.js';

export function mathHTML(src, display = false, fallback = '\u00a0') {
    const cls = display ? 'math math-block' : 'math';
    return `<span class="${cls}" data-tex="${esc(src)}">${esc(fallback)}</span>`;
}

export function ensureKatexCss() {
    if (document.querySelector('link[data-rlc-katex]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    link.dataset.rlcKatex = '1';
    document.head.appendChild(link);
}

let loading = null;

export function ensureKatex() {
    if (window.katex?.render) return Promise.resolve(window.katex);
    if (!loading) {
        loading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
            script.onload = () => (window.katex?.render ? resolve(window.katex) : reject(new Error('KaTeX не появился')));
            script.onerror = () => reject(new Error('KaTeX не загрузился'));
            document.head.appendChild(script);
        }).catch((err) => {
            loading = null;
            throw err;
        });
    }
    return loading;
}

export async function renderMath(root) {
    if (!root) return;
    const nodes = [...root.querySelectorAll('.math')].filter((n) => !n.dataset.done && !n.dataset.pending);
    if (!nodes.length) return;
    nodes.forEach((n) => { n.dataset.pending = '1'; });
    let katex;
    try {
        katex = await ensureKatex();
    } catch (err) {
        console.warn(err);
        nodes.forEach((n) => { delete n.dataset.pending; n.dataset.done = '1'; });
        return;
    }
    for (const n of nodes) {
        delete n.dataset.pending;
        try {
            katex.render(n.dataset.tex || '', n, {
                throwOnError: false,
                displayMode: n.classList.contains('math-block'),
                output: 'html',
                strict: 'ignore',
            });
        } catch (err) {
            console.warn(err);
        }
        n.dataset.done = '1';
    }
}

export function html(el, markup) {
    if (!el) return;
    el.innerHTML = markup || '';
    renderMath(el);
}