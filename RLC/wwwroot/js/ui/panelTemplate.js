import { mathHTML } from './katexView.js';

export function panelTemplate() {
    const L = String.raw;
    const i = (latex, fallback) => mathHTML(latex, false, fallback);
    const d = (latex, fallback) => mathHTML(latex, true, fallback);
    return `
<header>
  <div><strong>Лабораторная №25</strong><span>Последовательный RLC-контур</span></div>
  <div class="ui-actions">
    <button type="button" class="ghost is-allowed" data-act="collapse">Свернуть</button>
    <button type="button" class="is-allowed js-cancel" data-act="cancel">Стоп</button>
  </div>
</header>
<div class="ui-progress" aria-hidden="true"><i id="lab-bar"></i></div>
<div class="ui-chips">
  <span id="lab-chip-gen">Генератор</span>
  <span id="lab-chip-circuit">Цепь</span>
  <span id="lab-chip-spk">Динамик</span>
  <span id="lab-chip-ch1">CH1</span>
  <span id="lab-chip-ch2">CH2</span>
</div>
<dl class="ui-readout">
  <div><dt>${i(L`f`, 'f')}</dt><dd><b id="lab-f">—</b> <i id="lab-f-lock" class="ui-badge" hidden>панель</i></dd></div>
  <div><dt>${i(L`\varepsilon_m`, 'εₘ')}</dt><dd id="lab-em">—</dd></div>
  <div><dt>${i(L`U_C`, 'U_C')}</dt><dd id="lab-uc">—</dd></div>
  <div><dt>${i(L`\varphi_C`, 'φ_C')}</dt><dd id="lab-phi">—</dd></div>
  <div><dt>${i(L`U_{LC}`, 'U_LC')}</dt><dd id="lab-ulc">—</dd></div>
  <div><dt>${i(L`R`, 'R')}</dt><dd><b id="lab-r">—</b> <i id="lab-r-lock" class="ui-badge" hidden>панель</i></dd></div>
  <div><dt>${i(L`f_0`, 'f₀')}</dt><dd id="lab-f0">—</dd></div>
  <div><dt>${i(L`Q_{\text{теор}}`, 'Q теор')}</dt><dd id="lab-q">—</dd></div>
</dl>
<nav class="ui-tabs" role="tablist">
  <button type="button" class="is-allowed" data-tab="guide">Инструкция</button>
  <button type="button" class="is-allowed" data-tab="exp1">Опыт 1</button>
  <button type="button" class="is-allowed" data-tab="exp2">Опыт 2</button>
  <button type="button" class="is-allowed" data-tab="exp3">Опыт 3</button>
  <button type="button" class="is-allowed" data-tab="remote">Заочник</button>
</nav>
<div class="ui-scroll">
  <p id="lab-status" class="ui-note"></p>
  <p id="lab-wave" class="ui-note" hidden></p>
  <section data-panel="guide">
    <h3>Как снять работу</h3>
    <ol>
      <li>Стенд уже собран: генератор → RLC → динамик, CH1 на ЭДС, CH2 на конденсаторе. Правый клик по проводу снимает его, два клика по клеммам — новый провод.</li>
      <li>Включи питание генератора и оставь синус. У резонанса громкость больше, потому что больше ток. Динамик звучит только когда соединены обе его клеммы, красная и чёрная.</li>
      <li>Опыт 1. Найди максимум ${i(L`U_C`, 'U_C')}. Сравни ${i(L`f_{\text{рез}}`, 'f рез')} с расчётом ниже и посчитай ${i(L`Q`, 'Q')} двумя способами.</li>
      <li>Опыт 2. Сними АЧХ и ФЧХ при ${i(L`R \approx 10~\Omega`, 'R ≈ 10 Ом')} и при ${i(L`R \approx 100~\Omega`, 'R ≈ 100 Ом')}. Малый ${i(L`R`, 'R')} — пик выше и уже.</li>
      <li>Опыт 3. Переключи CH2 на LC-цепочку. На резонансе ${i(L`U_C`, 'U_C')} максимально, а ${i(L`U_{LC}`, 'U_LC')} минимально.</li>
      <li>Количественные выводы — по осциллографу и графикам. Звук только подсказывает, где резонанс.</li>
    </ol>
    ${d(L`f_0=\dfrac{1}{2\pi\sqrt{LC}}`, 'f₀ = 1 / (2π√(LC))')}
    ${d(L`Q_1=\dfrac{U_C^{\text{рез}}}{\varepsilon_m}`, 'Q₁ = U_C рез / ε_m')}
    ${d(L`Q_2=\dfrac{f_{\text{рез}}}{\Delta f}`, 'Q₂ = f рез / Δf')}
    ${d(L`Q\approx\dfrac{1}{R}\sqrt{\dfrac{L}{C}}`, 'Q ≈ (1/R)√(L/C)')}
    <p class="ui-help">Номиналы стенда: ${i(L`L=10`, 'L = 10')} мГн, ${i(L`C=1`, 'C = 1')} мкФ, ${i(L`f_0\approx 1592`, 'f₀ ≈ 1592')} Гц. Ручка меняет ${i(L`R`, 'R')} от 10 до 1000 Ом.</p>
  </section>
  <section data-panel="exp1" hidden>
    <h3>Резонанс и добротность</h3>
    <div class="ui-actions">
      <button type="button" class="primary" data-act="find-resonance">Найти резонанс</button>
      <button type="button" data-act="capture">Зафиксировать точку</button>
      <button type="button" data-act="take-live">Взять текущие ${i(L`U_C`, 'U_C')} и ${i(L`\varepsilon_m`, 'εₘ')}</button>
    </div>
    <div id="lab-res" class="ui-card" hidden>
      <div><span class="ui-lab">${i(L`f_{\text{рез}}`, 'f рез')}, эксп.</span><b id="lab-res-f" class="ui-kv"></b></div>
      <div><span>${i(L`f_0=1/(2\pi\sqrt{LC})`, 'f₀')}</span><b id="lab-res-f0" class="ui-kv"></b></div>
      <div><span>Расхождение</span><b id="lab-res-err" class="ui-kv"></b></div>
      <div><span>${i(L`U_C^{\text{рез}}`, 'U_C рез')}</span><b id="lab-res-uc" class="ui-kv"></b></div>
      <div><span class="ui-lab">${i(L`\varphi_C`, 'φ_C')} на резонансе</span><b id="lab-res-phi" class="ui-kv"></b></div>
      <p id="lab-res-note" class="ui-note"></p>
    </div>
    <div class="math-stack">
      ${d(L`Q_1=\dfrac{U_C^{\text{рез}}}{\varepsilon_m}`, 'Q₁ = U_C рез / ε_m')}
      ${d(L`Q_2=\dfrac{f_{\text{рез}}}{\Delta f}`, 'Q₂ = f рез / Δf')}
      <p class="ui-help">${i(L`\Delta f`, 'Δf')} — ширина кривой на уровне</p>
      ${d(L`\dfrac{U_C^{\text{рез}}}{\sqrt{2}}\approx 0{,}707\,U_C^{\text{рез}}`, 'U_C рез / √2')}
    </div>
    <label for="lab-in-uc"><span class="ui-lab">${i(L`U_C^{\text{рез}}`, 'U_C рез')}, В</span></label>
    <input id="lab-in-uc" inputmode="decimal" autocomplete="off" spellcheck="false" />
    <label for="lab-in-em"><span class="ui-lab">${i(L`\varepsilon_m`, 'εₘ')}, В</span></label>
    <input id="lab-in-em" inputmode="decimal" autocomplete="off" spellcheck="false" />
    <div class="ui-actions">
      <button type="button" data-act="q1">Рассчитать ${i(L`Q_1`, 'Q₁')}</button>
      <b id="lab-q1" class="ui-kv">—</b>
    </div>
    <p id="lab-q1-note" class="ui-note"></p>
    <p id="lab-df-hint" class="ui-help">После поиска резонанса здесь появятся две частоты уровня 0,707 от максимума. Это подсказка модели: её сверяют с графиком, а не списывают вслепую.</p>
    <label for="lab-in-df"><span class="ui-lab">${i(L`\Delta f`, 'Δf')}, Гц</span></label>
    <input id="lab-in-df" inputmode="decimal" autocomplete="off" spellcheck="false" />
    <div class="ui-actions">
      <button type="button" data-act="use-df">Подставить подсказку ${i(L`\Delta f`, 'Δf')}</button>
      <button type="button" data-act="q2">Рассчитать ${i(L`Q_2`, 'Q₂')}</button>
      <b id="lab-q2" class="ui-kv">—</b>
    </div>
    <p id="lab-q2-note" class="ui-note"></p>
    <h3>Журнал точек</h3>
    <div class="ui-table-wrap">
      <table>
        <thead><tr><th>№</th><th class="ui-lab">${i(L`f`, 'f')}, Гц</th><th>${i(L`\varepsilon_m`, 'εₘ')}</th><th>${i(L`U_C`, 'U_C')}</th><th class="ui-lab">${i(L`\varphi`, 'φ')}, °</th><th>${i(L`R`, 'R')}</th><th>CH2</th><th></th></tr></thead>
        <tbody id="lab-points"></tbody>
      </table>
    </div>
  </section>
  <section data-panel="exp2" hidden>
    <h3>АЧХ и ФЧХ, напряжение на ${i(L`C`, 'C')}</h3>
    <p class="ui-help">Прогон от ${i(L`0{,}5f_0`, '0,5 f₀')} до ${i(L`1{,}5f_0`, '1,5 f₀')}, 81 точка. Генератор на время прогона пробегает частоты, затем возвращается. Кривая считается по тем ${i(L`R`, 'R')}, ${i(L`L`, 'L')}, ${i(L`C`, 'C')} и ${i(L`\varepsilon_m`, 'εₘ')}, которые были в момент нажатия.</p>
    <div class="ui-actions">
      <button type="button" class="primary" data-act="sweep-c">Снять АЧХ/ФЧХ</button>
      <button type="button" data-act="save-c">Сохранить кривую</button>
      <button type="button" data-act="clear-c">Убрать сохранённые</button>
    </div>
    <label class="ui-check"><input class="js-phase" type="checkbox" checked /> Фаза на правой оси</label>
    <div class="ui-chart"><canvas id="lab-chart-c"></canvas></div>
    <p id="lab-compare" class="ui-note"></p>
    <details><summary>Таблица прогона</summary><div id="lab-table-c" class="ui-table-wrap"></div></details>
  </section>
  <section data-panel="exp3" hidden>
    <h3>Напряжение на ${i(L`LC`, 'LC')}-цепочке</h3>
    <p class="ui-help">Синий щуп переносится на выход контура. На резонансе ${i(L`X_L \approx X_C`, 'X_L ≈ X_C')}, поэтому ${i(L`U_{LC}`, 'U_LC')} минимально, почти ноль. Громкость при этом не падает: она следует за током, а ток на резонансе максимален.</p>
    ${d(L`U_{LC,m}=\varepsilon_m\dfrac{\left|\omega L-\dfrac{1}{\omega C}\right|}{\sqrt{R^2+\left(\omega L-\dfrac{1}{\omega C}\right)^2}}`, 'U_LC = ε_m · |X_L − X_C| / |Z|')}
    <div class="ui-actions">
      <button type="button" data-act="probe-lc">CH2 на LC</button>
      <button type="button" data-act="probe-c">CH2 на C</button>
      <button type="button" class="primary" data-act="sweep-lc">Снять АЧХ ${i(L`U_{LC}`, 'U_LC')}</button>
    </div>
    <label class="ui-check"><input class="js-phase" type="checkbox" checked /> Фаза на правой оси</label>
    <div class="ui-chart"><canvas id="lab-chart-lc"></canvas></div>
    <p id="lab-lc-note" class="ui-note"></p>
    <p class="ui-help">Скачок фазы ${i(L`U_{LC}`, 'U_LC')} около резонанса — ветвь ${i(L`\arctan`, 'arctan')} в модели, та же, что на осциллографе. Для вывода смотри минимум амплитуды.</p>
    <details><summary>Таблица прогона</summary><div id="lab-table-lc" class="ui-table-wrap"></div></details>
  </section>
  <section data-panel="remote" hidden>
    <h3>Режим заочника</h3>
    <p class="ui-help">Сборка проводов не заменяет обработку. Нужно найти резонанс, сравнить ${i(L`f_0`, 'f₀')}, посчитать ${i(L`Q`, 'Q')} двумя способами и объяснить максимум ${i(L`U_C`, 'U_C')} и минимум ${i(L`U_{LC}`, 'U_LC')}.</p>
    <div class="ui-actions">
      <button type="button" class="primary" data-act="assemble">Собрать схему</button>
      <button type="button" data-act="power">Включить генератор, 2 В</button>
    </div>
    <div class="ui-actions">
      <button type="button" data-act="set-r" data-r="10">${i(L`R=10`, 'R = 10')}</button>
      <button type="button" data-act="set-r" data-r="50">${i(L`R=50`, 'R = 50')}</button>
      <button type="button" data-act="set-r" data-r="100">${i(L`R=100`, 'R = 100')}</button>
      <button type="button" data-act="set-r" data-r="200">${i(L`R=200`, 'R = 200')}</button>
    </div>
    <label for="lab-in-r"><span class="ui-lab">Задать ${i(L`R`, 'R')}, Ом</span> (ручка платы: 10…1000)</label>
    <div class="ui-row">
      <input id="lab-in-r" inputmode="decimal" autocomplete="off" spellcheck="false" />
      <button type="button" data-act="apply-r">Поставить</button>
    </div>
    <label for="lab-l"><span class="ui-lab">${i(L`L`, 'L')}, мГн</span></label>
    <input id="lab-l" inputmode="decimal" autocomplete="off" spellcheck="false" />
    <label for="lab-c"><span class="ui-lab">${i(L`C`, 'C')}, мкФ</span></label>
    <input id="lab-c" inputmode="decimal" autocomplete="off" spellcheck="false" />
    <label for="lab-conclusion">Вывод своими словами</label>
    <textarea id="lab-conclusion" placeholder="Сравни f рез и f0. Сравни Q1 и Q2. Что стало с пиком при большем R? Почему ULC на резонансе минимально?"></textarea>
    <div class="ui-actions">
      <button type="button" data-act="csv">Скачать CSV</button>
      <button type="button" data-act="print">Сформировать отчёт</button>
      <button type="button" data-act="reset-journal">Сбросить журнал</button>
    </div>
    <details><summary>Какие провода сейчас в сцене</summary><pre id="lab-wires"></pre></details>
  </section>
</div>`;
}