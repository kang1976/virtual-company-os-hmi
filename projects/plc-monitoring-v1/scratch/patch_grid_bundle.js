const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../public/grid/assets/index-B7rPQVR9.js');
let code = fs.readFileSync(bundlePath, 'utf8');

const targetStr = 'N9=document.getElementById(`themeSelect`)';
if (code.includes(targetStr)) {
  code = code.replace(
    'function x_t(e){document.documentElement.removeAttribute(`data-custom-theme`);let t=document.getElementById(`__customTheme`);t&&(t.textContent=``),localStorage.removeItem(`plcThemeMode`),document.documentElement.dataset.theme=e,localStorage.setItem(`plcTheme`,e),N9.value=e}if(localStorage.getItem(`plcThemeMode`)===`custom`)try{N9.value=JSON.parse(localStorage.getItem(`plcCustomTheme`)||`{}`).fallback===`dark`?`dark`:`light`}catch{N9.value=`light`}else{let e=localStorage.getItem(`plcTheme`);e?x_t(e):N9.value=document.documentElement.dataset.theme||`light`}N9.addEventListener(`change`,()=>{x_t(N9.value)});',
    'function x_t(e){document.documentElement.removeAttribute(`data-custom-theme`);let t=document.getElementById(`__customTheme`);t&&(t.textContent=``),localStorage.removeItem(`plcThemeMode`),document.documentElement.dataset.theme=e,localStorage.setItem(`plcTheme`,e),N9&&(N9.value=e)}if(localStorage.getItem(`plcThemeMode`)===`custom`)try{N9&&(N9.value=JSON.parse(localStorage.getItem(`plcCustomTheme`)||`{}`).fallback===`dark`?`dark`:`light`)}catch{N9&&(N9.value=`light`)}else{let e=localStorage.getItem(`plcTheme`);e?x_t(e):N9&&(N9.value=document.documentElement.dataset.theme||`light`)}N9&&N9.addEventListener(`change`,()=>{x_t(N9.value)});'
  );
  fs.writeFileSync(bundlePath, code, 'utf8');
  console.log('Successfully patched index-B7rPQVR9.js for N9 null safety');
} else {
  console.log('Target string not found in index-B7rPQVR9.js');
}
