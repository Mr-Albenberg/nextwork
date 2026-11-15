/* Keyboard accessibility for the shared #modal: moves focus into the dialog when it opens,
   keeps Tab inside it, and returns focus to the control that opened it. Escape is already
   handled in app.js. Works by observing the modal, so no dialog code needs to change. */
(function(){
const modal=document.getElementById('modal');if(!modal||typeof MutationObserver==='undefined')return;
const focusable='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let opener=null;
const items=()=>[...modal.querySelectorAll(focusable)].filter(n=>n.offsetParent!==null||n===document.activeElement);
function opened(){opener=document.activeElement&&document.activeElement!==document.body?document.activeElement:opener;setTimeout(()=>{if(modal.hidden||modal.contains(document.activeElement))return;const dialog=modal.querySelector('.dialog'),first=items().find(n=>!n.classList.contains('close'))||items()[0];if(first)first.focus();else if(dialog){dialog.tabIndex=-1;dialog.focus()}},30)}
function closed(){const back=opener;opener=null;if(back&&document.contains(back)&&typeof back.focus==='function')back.focus()}
new MutationObserver(()=>{modal.hidden?closed():opened()}).observe(modal,{attributes:true,attributeFilter:['hidden']});
modal.addEventListener('keydown',e=>{if(e.key!=='Tab'||modal.hidden)return;const list=items();if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}else if(!modal.contains(document.activeElement)){e.preventDefault();first.focus()}});
})();
