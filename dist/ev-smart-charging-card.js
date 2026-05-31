/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),r=new WeakMap;let o=class n{constructor(t,e,r){if(this._$cssResult$=!0,r!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const s=this.t;if(e&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=r.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&r.set(s,t))}return t}toString(){return this.cssText}};const l=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:h,defineProperty:d,getOwnPropertyDescriptor:p,getOwnPropertyNames:g,getOwnPropertySymbols:u,getPrototypeOf:m}=Object,_=globalThis,f=_.trustedTypes,v=f?f.emptyScript:"",$=_.reactiveElementPolyfillSupport,d$1=(t,e)=>t,x={toAttribute(t,e){switch(e){case Boolean:t=t?v:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let s=t;switch(e){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t)}catch(t){s=null}}return s}},f$1=(t,e)=>!h(t,e),b={attribute:!0,type:String,converter:x,reflect:!1,useDefault:!1,hasChanged:f$1};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),_.litPropertyMetadata??=new WeakMap;let w=class y extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),r=this.getPropertyDescriptor(t,s,e);void 0!==r&&d(this.prototype,t,r)}}static getPropertyDescriptor(t,e,s){const{get:r,set:o}=p(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:r,set(e){const l=r?.call(this);o?.call(this,e),this.requestUpdate(t,l,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(d$1("elementProperties")))return;const t=m(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(d$1("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(d$1("properties"))){const t=this.properties,e=[...g(t),...u(t)];for(const s of e)this.createProperty(s,t[s])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,s]of e)this.elementProperties.set(t,s)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const s=this._$Eu(t,e);void 0!==s&&this._$Eh.set(s,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const t of s)e.unshift(l(t))}else void 0!==t&&e.push(l(t));return e}static _$Eu(t,e){const s=e.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((s,r)=>{if(e)s.adoptedStyleSheets=r.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of r){const r=document.createElement("style"),o=t.litNonce;void 0!==o&&r.setAttribute("nonce",o),r.textContent=e.cssText,s.appendChild(r)}})(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,s);if(void 0!==r&&!0===s.reflect){const o=(void 0!==s.converter?.toAttribute?s.converter:x).toAttribute(e,s.type);this._$Em=t,null==o?this.removeAttribute(r):this.setAttribute(r,o),this._$Em=null}}_$AK(t,e){const s=this.constructor,r=s._$Eh.get(t);if(void 0!==r&&this._$Em!==r){const t=s.getPropertyOptions(r),o="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:x;this._$Em=r;const l=o.fromAttribute(e,t.type);this[r]=l??this._$Ej?.get(r)??l,this._$Em=null}}requestUpdate(t,e,s,r=!1,o){if(void 0!==t){const l=this.constructor;if(!1===r&&(o=this[t]),s??=l.getPropertyOptions(t),!((s.hasChanged??f$1)(o,e)||s.useDefault&&s.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(l._$Eu(t,s))))return;this.C(t,e,s)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:r,wrapped:o},l){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,l??e??this[t]),!0!==o||void 0!==l)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),!0===r&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,s]of t){const{wrapped:t}=s,r=this[e];!0!==t||this._$AL.has(e)||void 0===r||this.C(e,void 0,s,r)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[d$1("elementProperties")]=new Map,w[d$1("finalized")]=new Map,$?.({ReactiveElement:w}),(_.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const C=globalThis,i$1=t=>t,A=C.trustedTypes,D=A?A.createPolicy("lit-html",{createHTML:t=>t}):void 0,E="$lit$",P=`lit$${Math.random().toFixed(9).slice(2)}$`,T="?"+P,F=`<${T}>`,O=document,c=()=>O.createComment(""),a=t=>null===t||"object"!=typeof t&&"function"!=typeof t,K=Array.isArray,U="[ \t\n\f\r]",B=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,j=/-->/g,W=/>/g,G=RegExp(`>|${U}(?:([^\\s"'>=/]+)(${U}*=${U}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),q=/'/g,J=/"/g,Y=/^(?:script|style|textarea|title)$/i,X=(t=>(e,...s)=>({_$litType$:t,strings:e,values:s}))(1),Q=Symbol.for("lit-noChange"),tt=Symbol.for("lit-nothing"),et=new WeakMap,st=O.createTreeWalker(O,129);function V(t,e){if(!K(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==D?D.createHTML(e):e}const N=(t,e)=>{const s=t.length-1,r=[];let o,l=2===e?"<svg>":3===e?"<math>":"",h=B;for(let e=0;e<s;e++){const s=t[e];let d,p,g=-1,u=0;for(;u<s.length&&(h.lastIndex=u,p=h.exec(s),null!==p);)u=h.lastIndex,h===B?"!--"===p[1]?h=j:void 0!==p[1]?h=W:void 0!==p[2]?(Y.test(p[2])&&(o=RegExp("</"+p[2],"g")),h=G):void 0!==p[3]&&(h=G):h===G?">"===p[0]?(h=o??B,g=-1):void 0===p[1]?g=-2:(g=h.lastIndex-p[2].length,d=p[1],h=void 0===p[3]?G:'"'===p[3]?J:q):h===J||h===q?h=G:h===j||h===W?h=B:(h=G,o=void 0);const m=h===G&&t[e+1].startsWith("/>")?" ":"";l+=h===B?s+F:g>=0?(r.push(d),s.slice(0,g)+E+s.slice(g)+P+m):s+P+(-2===g?e:m)}return[V(t,l+(t[s]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),r]};class S{constructor({strings:t,_$litType$:e},s){let r;this.parts=[];let o=0,l=0;const h=t.length-1,d=this.parts,[p,g]=N(t,e);if(this.el=S.createElement(p,s),st.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(r=st.nextNode())&&d.length<h;){if(1===r.nodeType){if(r.hasAttributes())for(const t of r.getAttributeNames())if(t.endsWith(E)){const e=g[l++],s=r.getAttribute(t).split(P),h=/([.?@])?(.*)/.exec(e);d.push({type:1,index:o,name:h[2],strings:s,ctor:"."===h[1]?I:"?"===h[1]?L:"@"===h[1]?z:H}),r.removeAttribute(t)}else t.startsWith(P)&&(d.push({type:6,index:o}),r.removeAttribute(t));if(Y.test(r.tagName)){const t=r.textContent.split(P),e=t.length-1;if(e>0){r.textContent=A?A.emptyScript:"";for(let s=0;s<e;s++)r.append(t[s],c()),st.nextNode(),d.push({type:2,index:++o});r.append(t[e],c())}}}else if(8===r.nodeType)if(r.data===T)d.push({type:2,index:o});else{let t=-1;for(;-1!==(t=r.data.indexOf(P,t+1));)d.push({type:7,index:o}),t+=P.length-1}o++}}static createElement(t,e){const s=O.createElement("template");return s.innerHTML=t,s}}function M(t,e,s=t,r){if(e===Q)return e;let o=void 0!==r?s._$Co?.[r]:s._$Cl;const l=a(e)?void 0:e._$litDirective$;return o?.constructor!==l&&(o?._$AO?.(!1),void 0===l?o=void 0:(o=new l(t),o._$AT(t,s,r)),void 0!==r?(s._$Co??=[])[r]=o:s._$Cl=o),void 0!==o&&(e=M(t,o._$AS(t,e.values),o,r)),e}class R{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,r=(t?.creationScope??O).importNode(e,!0);st.currentNode=r;let o=st.nextNode(),l=0,h=0,d=s[0];for(;void 0!==d;){if(l===d.index){let e;2===d.type?e=new k(o,o.nextSibling,this,t):1===d.type?e=new d.ctor(o,d.name,d.strings,this,t):6===d.type&&(e=new Z(o,this,t)),this._$AV.push(e),d=s[++h]}l!==d?.index&&(o=st.nextNode(),l++)}return st.currentNode=O,r}p(t){let e=0;for(const s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,r){this.type=2,this._$AH=tt,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=M(this,t,e),a(t)?t===tt||null==t||""===t?(this._$AH!==tt&&this._$AR(),this._$AH=tt):t!==this._$AH&&t!==Q&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>K(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==tt&&a(this._$AH)?this._$AA.nextSibling.data=t:this.T(O.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,r="number"==typeof s?this._$AC(t):(void 0===s.el&&(s.el=S.createElement(V(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===r)this._$AH.p(e);else{const t=new R(r,this),s=t.u(this.options);t.p(e),this.T(s),this._$AH=t}}_$AC(t){let e=et.get(t.strings);return void 0===e&&et.set(t.strings,e=new S(t)),e}k(t){K(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,r=0;for(const o of t)r===e.length?e.push(s=new k(this.O(c()),this.O(c()),this,this.options)):s=e[r],s._$AI(o),r++;r<e.length&&(this._$AR(s&&s._$AB.nextSibling,r),e.length=r)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=i$1(t).nextSibling;i$1(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class H{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,r,o){this.type=1,this._$AH=tt,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=o,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=tt}_$AI(t,e=this,s,r){const o=this.strings;let l=!1;if(void 0===o)t=M(this,t,e,0),l=!a(t)||t!==this._$AH&&t!==Q,l&&(this._$AH=t);else{const r=t;let h,d;for(t=o[0],h=0;h<o.length-1;h++)d=M(this,r[s+h],e,h),d===Q&&(d=this._$AH[h]),l||=!a(d)||d!==this._$AH[h],d===tt?t=tt:t!==tt&&(t+=(d??"")+o[h+1]),this._$AH[h]=d}l&&!r&&this.j(t)}j(t){t===tt?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class I extends H{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===tt?void 0:t}}class L extends H{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==tt)}}class z extends H{constructor(t,e,s,r,o){super(t,e,s,r,o),this.type=5}_$AI(t,e=this){if((t=M(this,t,e,0)??tt)===Q)return;const s=this._$AH,r=t===tt&&s!==tt||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,o=t!==tt&&(s===tt||r);r&&this.element.removeEventListener(this.name,this,s),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class Z{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){M(this,t)}}const it=C.litHtmlPolyfillSupport;it?.(S,k),(C.litHtmlVersions??=[]).push("3.3.3");const rt=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class i extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,s)=>{const r=s?.renderBefore??e;let o=r._$litPart$;if(void 0===o){const t=s?.renderBefore??null;r._$litPart$=o=new k(e.insertBefore(c(),t),t,void 0,s??{})}return o._$AI(t),o})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Q}}i._$litElement$=!0,i.finalized=!0,rt.litElementHydrateSupport?.({LitElement:i});const at=rt.litElementPolyfillSupport;at?.({LitElement:i}),(rt.litElementVersions??=[]).push("4.2.2");const nt=((t,...e)=>{const r=1===t.length?t[0]:e.reduce((e,s,r)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[r+1],t[0]);return new o(r,t,s)})`
  :host {
    display: block;
    font-family: var(--paper-font-body1_-_font-family, sans-serif);
    max-width: 720px;
    margin: 16px auto;
  }

  ha-card {
    padding: 16px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 1.2em;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .refresh-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--secondary-text-color);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .refresh-btn:hover {
    background: var(--secondary-background-color);
  }

  /* ---- Car selector ---- */
  .car-selector {
    margin-bottom: 16px;
  }

  .car-selector select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 1em;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }

  /* ---- Status panel ---- */
  .status-panel {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }

  .stat-card {
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 12px;
    text-align: center;
  }

  .stat-value {
    font-size: 1.6em;
    font-weight: 700;
    color: var(--primary-text-color);
    line-height: 1.2;
  }

  .stat-label {
    font-size: 0.75em;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .soc-bar-wrap {
    grid-column: 1 / -1;
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 12px 14px;
  }

  .soc-bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8em;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
  }

  .soc-bar {
    height: 14px;
    border-radius: 7px;
    background: var(--divider-color);
    overflow: hidden;
  }

  .soc-bar-fill {
    height: 100%;
    border-radius: 7px;
    background: var(--success-color, #4caf50);
    transition: width 0.5s ease;
  }

  .soc-bar-fill.low {
    background: var(--warning-color, #ff9800);
  }

  .soc-bar-fill.critical {
    background: var(--error-color, #f44336);
  }

  .manual-soc-row {
    grid-column: 1 / -1;
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 12px 14px;
  }

  .manual-soc-row label {
    font-size: 0.85em;
    color: var(--secondary-text-color);
    display: block;
    margin-bottom: 6px;
  }

  .manual-soc-row input[type="range"] {
    width: 100%;
    accent-color: var(--primary-color);
  }

  .manual-soc-value {
    text-align: right;
    font-size: 0.85em;
    color: var(--primary-text-color);
    margin-top: 4px;
  }

  .no-integration-note {
    grid-column: 1 / -1;
    font-size: 0.8em;
    color: var(--secondary-text-color);
    background: var(--secondary-background-color);
    border-radius: 8px;
    padding: 8px 12px;
    text-align: center;
  }

  /* ---- Mode selector ---- */
  .section-label {
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--secondary-text-color);
    margin: 14px 0 8px;
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }

  .mode-btn {
    padding: 10px 4px;
    border: 2px solid var(--divider-color);
    border-radius: 10px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 0.8em;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
    line-height: 1.3;
  }

  .mode-btn.active {
    border-color: var(--primary-color);
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    font-weight: 600;
  }

  /* ---- Settings panel ---- */
  .settings-panel {
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 14px;
  }

  .setting-row {
    margin-bottom: 14px;
  }

  .setting-row:last-child {
    margin-bottom: 0;
  }

  .setting-row label {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
  }

  .setting-row label span {
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .setting-row input[type="range"] {
    width: 100%;
    accent-color: var(--primary-color);
  }

  .setting-row input[type="time"],
  .setting-row input[type="number"] {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 0.95em;
    box-sizing: border-box;
  }

  /* ---- Estimate ---- */
  .estimate-box {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 14px;
  }

  .estimate-box.loading {
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
  }

  .estimate-title {
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.85;
    margin-bottom: 8px;
  }

  .estimate-main {
    font-size: 1.4em;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .estimate-sub {
    font-size: 0.85em;
    opacity: 0.9;
  }

  .estimate-stats {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .estimate-stat {
    font-size: 0.8em;
    opacity: 0.9;
  }

  /* ---- Timeline ---- */
  .timeline-wrap {
    margin-bottom: 14px;
  }

  .timeline-bar {
    display: flex;
    height: 28px;
    border-radius: 8px;
    overflow: hidden;
    gap: 1px;
  }

  .timeline-slot {
    flex: 1;
    min-width: 1px;
    background: var(--divider-color);
    transition: background 0.3s;
  }

  .timeline-slot.past {
    opacity: 0.3;
  }

  .timeline-slot.charging {
    background: var(--primary-color);
  }

  .timeline-slot.charging.cheap {
    background: var(--success-color, #4caf50);
  }

  .timeline-slot.charging.peak {
    background: var(--warning-color, #ff9800);
  }

  .timeline-day-label {
    font-size: 0.78em;
    font-weight: 600;
    color: var(--secondary-text-color);
    margin: 10px 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .day-header-row td {
    font-size: 0.78em;
    font-weight: 600;
    color: var(--secondary-text-color);
    padding: 8px 6px 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .past-row {
    opacity: 0.4;
  }

  .timeline-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7em;
    color: var(--secondary-text-color);
    margin-top: 4px;
    padding: 0 2px;
  }

  /* ---- Hour table ---- */
  .price-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82em;
    margin-bottom: 8px;
  }

  .price-table th {
    text-align: left;
    color: var(--secondary-text-color);
    font-weight: 600;
    padding: 4px 6px;
    border-bottom: 1px solid var(--divider-color);
  }

  .price-table td {
    padding: 6px 6px;
    border-bottom: 1px solid var(--divider-color);
    color: var(--primary-text-color);
  }

  .price-table tr.charging-row td {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }

  .price-table tr.now-row td {
    font-weight: 700;
  }

  .charge-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success-color, #4caf50);
    margin-right: 4px;
  }

  .table-toggle {
    background: none;
    border: none;
    color: var(--primary-color);
    font-size: 0.82em;
    cursor: pointer;
    padding: 6px 0;
    width: 100%;
    text-align: center;
  }

  /* ---- Price widget ---- */
  .price-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 14px;
  }

  .price-chip {
    background: var(--secondary-background-color);
    border-radius: 8px;
    padding: 10px 8px;
    text-align: center;
  }

  .price-chip-label {
    font-size: 0.7em;
    color: var(--secondary-text-color);
    margin-bottom: 4px;
  }

  .price-chip-value {
    font-size: 1em;
    font-weight: 700;
    color: var(--primary-text-color);
  }

  /* ---- Other cars status strip ---- */
  .other-cars-strip {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 16px 4px;
  }
  .other-car-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--secondary-background-color);
    border: 1px solid var(--divider-color, rgba(255,255,255,.1));
    border-radius: 20px;
    padding: 5px 12px;
    cursor: pointer;
    font-size: 0.82em;
    transition: background 0.15s;
  }
  .other-car-chip:hover {
    background: var(--primary-color, #03a9f4);
    color: white;
  }
  .other-car-name { font-weight: 600; }
  .other-car-soc { opacity: .75; }
  .other-car-mode { opacity: .65; font-style: italic; }
  .other-car-status.oc-charging { color: #4caf50; }
  .other-car-next { opacity: .6; font-size: .9em; }

  /* ---- Price strip ---- */
  .price-strip {
    display: flex;
    align-items: stretch;
    background: var(--secondary-background-color);
    border-radius: 10px;
    margin-bottom: 4px;
    overflow: hidden;
  }

  .price-strip-item {
    flex: 1;
    padding: 10px 8px;
    text-align: center;
  }

  .price-strip-divider {
    width: 1px;
    background: var(--divider-color);
    margin: 8px 0;
  }

  .ps-label { font-size: 0.68em; color: var(--secondary-text-color); margin-bottom: 2px; }
  .ps-value { font-size: 1.1em; font-weight: 700; color: var(--primary-text-color); }
  .ps-unit  { font-size: 0.65em; color: var(--secondary-text-color); }

  .price-cheap .ps-value { color: var(--success-color, #4caf50); }
  .price-peak  .ps-value { color: var(--error-color, #f44336); }
  .price-mid   .ps-value { color: var(--warning-color, #ff9800); }

  /* ---- Smart tip ---- */
  .smart-tip {
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    border-left: 3px solid var(--primary-color);
    border-radius: 0 8px 8px 0;
    padding: 8px 12px;
    font-size: 0.82em;
    color: var(--primary-text-color);
    margin-bottom: 10px;
    line-height: 1.4;
  }

  /* ---- Combined SVG chart ---- */
  .combined-chart-wrap {
    margin: 14px 0 4px;
  }

  .combined-svg {
    width: 100%;
    height: auto;
    display: block;
    color: var(--primary-text-color);
    overflow: visible;
  }

  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.72em;
    color: var(--secondary-text-color);
    margin-top: 6px;
    padding: 0 4px;
  }

  .legend-item { display: flex; align-items: center; gap: 5px; }

  .legend-swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-line-swatch {
    display: inline-block;
    width: 18px;
    height: 3px;
    background: #2196f3;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .execute-wrap {
    margin: 12px 0 4px;
    text-align: center;
  }

  .execute-btn {
    width: 100%;
    padding: 14px;
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border: none;
    border-radius: 10px;
    font-size: 1em;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .execute-btn:disabled { opacity: 0.5; cursor: default; }
  .execute-btn.executing { opacity: 0.7; }

  .action-status {
    margin-top: 8px;
    font-size: 0.85em;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
  }

  .action-status.action-started { color: var(--success-color, #4caf50); }
  .action-status.action-stopped { color: var(--warning-color, #ff9800); }
  .action-status.action-ok { color: var(--info-color, #2196f3); }

  .auto-note {
    font-size: 0.72em;
    color: var(--secondary-text-color);
    margin-top: 4px;
  }

  /* ---- Next charge banner ---- */
  .next-charge {
    background: var(--secondary-background-color);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.88em;
    color: var(--primary-text-color);
    margin-bottom: 10px;
  }

  .next-charge.charging-now {
    background: var(--success-color, #4caf50);
    color: #fff;
    font-weight: 600;
  }

  /* ---- Price bar chart ---- */
  .price-chart-wrap {
    margin: 14px 0 4px;
  }

  .chart-section {
    margin-top: 8px;
  }

  .chart-section-label {
    font-size: 0.75em;
    color: var(--secondary-text-color);
    margin-bottom: 4px;
  }

  .price-chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 64px;
  }

  .price-bar-col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
  }

  .price-bar-inner {
    width: 100%;
    border-radius: 3px 3px 0 0;
    background: var(--secondary-text-color, #888);
    transition: height 0.3s;
    opacity: 0.85;
  }

  .price-bar-inner.charging { background: var(--success-color, #4caf50); opacity: 1; }
  .price-bar-inner.past { opacity: 0.3; }
  .price-bar-inner.now { outline: 2px solid var(--primary-color); outline-offset: 1px; }

  .chart-axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.68em;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  /* ---- Savings highlight ---- */
  .savings {
    color: var(--success-color, #4caf50);
    font-weight: 600;
  }

  .price-chip-note {
    font-size: 0.68em;
    color: var(--secondary-text-color);
    text-align: center;
    margin-top: 4px;
    padding: 0 8px;
  }
  .error-box {
    background: var(--error-color, #f44336);
    color: #fff;
    border-radius: 8px;
    padding: 12px;
    font-size: 0.85em;
    margin-bottom: 12px;
  }

  .loading-spinner {
    text-align: center;
    color: var(--secondary-text-color);
    padding: 24px;
    font-size: 0.9em;
  }
`,ot="ev_smart_charging_",ct="input_text.ev_settings_",lt={mode:"Cheapest Hours",price_threshold:.5,cheapest_hours:4,departure_time:"07:00",target_soc:80,charge_limit:100,manual_soc:20};function loadCarSettings(t,e){const s=`${ct}${e}`,r=t?.states[s]?.state;if(r&&"unknown"!==r&&"unavailable"!==r)try{const t=JSON.parse(r);try{localStorage.setItem(`${ot}${e}`,r)}catch{}return{...lt,...t}}catch{}try{const t=localStorage.getItem(`${ot}${e}`);if(t)return{...lt,...JSON.parse(t)}}catch{}return{...lt}}async function saveCarSettings(t,e,s){const r=`${ct}${e}`,o=JSON.stringify(s);try{localStorage.setItem(`${ot}${e}`,o)}catch{}const l=await async function ensurePersistentHelper(t,e){const s=`${ct}${e}`;if(t.states[s])return!0;try{return await t.callApi("POST","config/input_text/config",{id:`ev_settings_${e}`,name:`EV Settings ${e}`,max:255,initial:""}),!0}catch(e){return e?.message?.includes("409")||console.warn("[ev-charging] Could not create input_text helper:",e?.message),!!t.states[s]}}(t,e);if(l)try{return void await t.callService("input_text","set_value",{entity_id:r,value:o})}catch(t){console.warn("[ev-charging] input_text.set_value failed, falling back:",t?.message)}try{await t.callApi("POST",`states/${r}`,{state:o})}catch(t){console.warn("[ev-charging] Could not save settings:",t?.message)}}async function fetchPricesForDate(t,e,s,r){try{const o=await t.callService("nordpool","get_prices_for_date",{date:r,areas:s,currency:"DKK",config_entry:e},void 0,void 0,!0);return(o?.response?.[s]??o?.[s]??[]).map(t=>({start:t.start,value:t.price/1e3})).sort((t,e)=>t.start.localeCompare(e.start))}catch(t){return console.warn("[ev-charging] No prices for",r,t?.message),[]}}function fmtDate(t){return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`}async function setCharging(t,e,s){e&&await t.callService("switch",s?"turn_on":"turn_off",{entity_id:e})}function getLiveSoC(t,e){if(!e)return null;const s=t.states[e];return s&&"unavailable"!==s.state&&"unknown"!==s.state?parseFloat(s.state):null}const ht={low:.11,high_summer:.17,high_winter:.32,peak_summer:.43,peak_winter:.97,energinet:.21,elafgift:0,supplier:0};function effectivePrice(t,e,s){const r={...ht,...s};return 1.25*t+function getN1Tariff(t,e=ht){const s=t.getHours(),r=t.getMonth()+1,o=r>=4&&r<=9;return s<6?e.low:s>=17&&s<21?o?e.peak_summer:e.peak_winter:o?e.high_summer:e.high_winter}(e,r)+(r.energinet??.21)+(r.elafgift??0)+(r.supplier??0)}const dt=["Charge Now","Cheapest Hours","Below Threshold","Departure Plan","Off"];customElements.define("ev-smart-charging-card",class EvSmartChargingCard extends i{static get properties(){return{hass:{type:Object},config:{type:Object},_selectedCarId:{type:String},_settings:{type:Object},_slots:{type:Array},_plan:{type:Array},_summary:{type:Object},_loading:{type:Boolean},_error:{type:String},_showTable:{type:Boolean},_lastAction:{type:String},_executing:{type:Boolean}}}static get styles(){return nt}constructor(){super(),this._selectedCarId=null,this._settings=null,this._slots=[],this._plan=[],this._summary=null,this._loading=!1,this._error=null,this._showTable=!1,this._controlInterval=null,this._lastAction=null,this._executing=!1,this._carsData={}}setConfig(t){if(!t.cars||0===t.cars.length)throw new Error("ev-smart-charging-card: 'cars' list is required in config.");this.config=t,this._selectedCarId=t.cars[0].id}get _cars(){return this.config?.cars??[]}get _selectedCar(){return this._cars.find(t=>t.id===this._selectedCarId)??this._cars[0]}get _tariffs(){return{...ht,...this.config?.tariffs??{}}}get _currentSoC(){const t=this._selectedCar,e=getLiveSoC(this.hass,t?.soc_entity);return null!==e?e:this._settings?.manual_soc??20}async connectedCallback(){super.connectedCallback(),this._startControlLoop()}disconnectedCallback(){super.disconnectedCallback(),this._controlInterval&&clearInterval(this._controlInterval)}_startControlLoop(){this._controlInterval&&clearInterval(this._controlInterval),this._controlInterval=setInterval(()=>this._runChargeControl(),3e5)}async updated(t){t.has("hass")&&this.hass&&0===Object.keys(this._carsData).length&&await this._loadAll(),t.has("hass")&&this.hass&&Object.keys(this._carsData).length>0&&this._runChargeControl()}async _loadAll(){if(this.hass&&!this._loading){this._loading=!0,this._error=null;try{for(const t of this._cars)this._carsData[t.id]||(this._carsData[t.id]={}),this._carsData[t.id].settings=loadCarSettings(this.hass,t.id);this._settings=this._carsData[this._selectedCarId]?.settings,await this._fetchAndPlanAll()}catch(t){this._error=`Error loading: ${t.message}`}finally{this._loading=!1}}}async _fetchAndPlanAll(){const t=this.config?.nordpool_config_entry,e=this.config?.area??"DK1";if(t){this._slots=await async function fetchTodayAndTomorrowPrices(t,e,s="DK1"){const r=new Date,o=new Date(r);o.setDate(o.getDate()+1);const[l,h]=await Promise.all([fetchPricesForDate(t,e,s,fmtDate(r)),fetchPricesForDate(t,e,s,fmtDate(o))]);return[...l,...h].sort((t,e)=>t.start.localeCompare(e.start))}(this.hass,t,e);for(const t of this._cars)this._rebuildPlanForCar(t.id);this._updateViewFromSelected()}else this._error="Missing nordpool_config_entry in card config."}async _fetchAndPlan(){return this._fetchAndPlanAll()}_rebuildPlanForCar(t){const e=this._cars.find(e=>e.id===t),s=this._carsData[t];if(!s?.settings||!this._slots.length)return;const r=(e?.soc_entity?getLiveSoC(this.hass,e.soc_entity):null)??s.settings.manual_soc??20,o={...s.settings,current_soc:r,battery_kwh:e?.battery_kwh??71.2,charge_kw:e?.charge_kw??this.config?.charger_speed_kw??9.5};s.plan=function buildChargePlan(t,e,s,r){if(!t||0===t.length)return[];const{cheapest_hours:o=4,price_threshold:l=.5,departure_time:h="07:00",target_soc:d=80,current_soc:p=20,battery_kwh:g=71.2,charge_kw:u=9.5}=s,m=new Date,_=t.map((t,e)=>{const s=new Date(t.start),o=effectivePrice(t.value,s,r);return{...t,localDate:s,ep:o,i:e,isFuture:s>=m}}),f=_.filter(t=>t.isFuture),v=new Set;if("Charge Now"===e)f.forEach(t=>v.add(t.i));else if("Cheapest Hours"===e)[...f].sort((t,e)=>t.ep-e.ep).slice(0,4*o).forEach(t=>v.add(t.i));else if("Below Threshold"===e)f.filter(t=>t.ep<=l).forEach(t=>v.add(t.i));else if("Departure Plan"===e){const[t,e]=h.split(":").map(Number),s=new Date;s.setHours(t,e,0,0),s<=m&&s.setDate(s.getDate()+1);const r=Math.max(0,(d-p)/100*g),o=Math.ceil(r/u*4),l=f.filter(t=>t.localDate<s);if(l.length>0&&o>0){const t=l.length<=o?l:[...l].sort((t,e)=>t.ep-e.ep).slice(0,o);t.forEach(t=>v.add(t.i))}}return _.map(t=>({start:t.start,localDate:t.localDate,value:t.value,ep:t.ep,charging:v.has(t.i),isPast:!t.isFuture}))}(this._slots,s.settings.mode,o,this._tariffs),s.summary=function planSummary(t,e){const{current_soc:s=20,battery_kwh:r=71.2,charge_kw:o=9.5,charge_limit:l=100}=e,h=t.filter(t=>t.charging&&!t.isPast),d=h.length/4*o,p=Math.min(l,100),g=r*(Math.max(0,p-s)/100),u=Math.min(d,g),m=Math.min(p,s+u/r*100),_=d>0?u/d:0,f=h.reduce((t,e)=>t+e.ep*o/4,0)*_,v=t.filter(t=>!t.isPast);return v.length?{kwh_added:u,final_soc:m,total_cost:f,cheapest_slot:v.reduce((t,e)=>e.ep<t.ep?e:t,v[0]),priciest_slot:v.reduce((t,e)=>e.ep>t.ep?e:t,v[0]),avg_ep:v.reduce((t,e)=>t+e.ep,0)/v.length}:{kwh_added:u,final_soc:m,total_cost:f,cheapest_slot:null,priciest_slot:null,avg_ep:0}}(s.plan,o)}_rebuildPlan(){this._rebuildPlanForCar(this._selectedCarId),this._updateViewFromSelected()}_updateViewFromSelected(){const t=this._carsData[this._selectedCarId];this._settings=t?.settings??null,this._plan=t?.plan??[],this._summary=t?.summary??null}async _runChargeControl(){const t=[];for(const e of this._cars){const s=this._carsData[e.id];if(!s?.settings||!s?.plan?.length)continue;const r=await this._runChargeControlForCar(e,s);r&&t.push(r)}return t.join(" | ")||"No plans active"}async _runChargeControlForCar(t,e){if(!t?.charging_switch)return`${t.name}: no switch`;if(t.plug_entity){const e=this.hass?.states[t.plug_entity]?.state;if("on"!==e){const e=this.hass.states[t.charging_switch]?.state;return"on"===e&&await setCharging(this.hass,t.charging_switch,!1),`${t.name}: 🔌 not connected`}}const s=new Date,r=e.settings?.mode;if("Charge Now"===r){const e=this.hass.states[t.charging_switch]?.state;return"on"!==e?(await setCharging(this.hass,t.charging_switch,!0),`${t.name}: ▶ started`):`${t.name}: ✓ charging`}const o=e.plan.find(t=>s>=t.localDate&&s<new Date(t.localDate.getTime()+9e5));if(!o)return`${t.name}: no slot`;const l=o.charging,h="on"===this.hass.states[t.charging_switch]?.state;return l&&!h?(await setCharging(this.hass,t.charging_switch,!0),`${t.name}: ▶ started (${o.ep?.toFixed(2)} kr)`):!l&&h?(await setCharging(this.hass,t.charging_switch,!1),`${t.name}: ⏸ stopped`):`${t.name}: ${h?"✓ charging":"– not scheduled"}`}async _onExecutePlan(){this._executing=!0,this._lastAction=null;try{const t=this._selectedCar,e=this._carsData[t?.id];if(!e)return void(this._lastAction="No plan loaded");const s=await this._runChargeControlForCar(t,e);this._lastAction=s}catch(t){this._lastAction=`Error: ${t.message}`}finally{this._executing=!1}}async _onChargeLimitChange(t){const e=this._carsData[this._selectedCarId];if(!e)return;e.settings={...e.settings,charge_limit:t},this._rebuildPlan(),saveCarSettings(this.hass,this._selectedCarId,e.settings);const s=this._selectedCar?.charge_limit_entity;s&&await this.hass.callService("number","set_value",{entity_id:s,value:t})}async _onCarChange(t){const e="string"==typeof t?t:t.target.value;this._selectedCarId=e,this._carsData[e]?.settings||(this._carsData[e]={settings:loadCarSettings(this.hass,e)},this._rebuildPlanForCar(e)),this._updateViewFromSelected()}async _onModeChange(t){const e=this._carsData[this._selectedCarId];e&&(e.settings={...e.settings,mode:t},this._rebuildPlan(),saveCarSettings(this.hass,this._selectedCarId,e.settings))}async _onSettingChange(t,e){const s=this._carsData[this._selectedCarId];s&&(s.settings={...s.settings,[t]:e},this._rebuildPlan(),saveCarSettings(this.hass,this._selectedCarId,s.settings))}async _onRefresh(){await this._loadAll()}_formatTime(t){return new Date(t).toLocaleTimeString("da-DK",{hour:"2-digit",minute:"2-digit"})}_fmt(t,e=2){return null!=t?t.toFixed(e):"–"}_socBarClass(t){return t<20?"critical":t<40?"low":""}_renderOtherCarsStatus(){if(this._cars.length<=1)return tt;const t=this._cars.filter(t=>t.id!==this._selectedCarId);return X`
      <div class="other-cars-strip">
        ${t.map(t=>{const e=this._carsData[t.id];if(!e)return tt;const s=(t.soc_entity?getLiveSoC(this.hass,t.soc_entity):null)??e.settings?.manual_soc??20,r=!!t.charging_switch&&"on"===this.hass?.states[t.charging_switch]?.state,o=!!t.plug_entity&&"on"===this.hass?.states[t.plug_entity]?.state,l=e.plan?.find(t=>!t.isPast&&t.charging&&t.localDate>new Date),h=e.settings?.mode??"–";return X`
            <div class="other-car-chip" @click=${()=>this._onCarChange(t.id)} title="Switch to ${t.name}">
              <span class="other-car-name">${t.name}</span>
              <span class="other-car-soc">${Math.round(s)}%</span>
              <span class="other-car-mode">${h}</span>
              <span class="other-car-status ${r?"oc-charging":""}">
                ${r?"⚡":o?"🔌":"–"}
              </span>
              ${l?X`<span class="other-car-next">→ ${this._formatTime(l.start)}</span>`:tt}
            </div>
          `})}
      </div>
    `}render(){return this.config?X`
      <ha-card>
        ${this._renderHeader()}
        ${this._error?X`<div class="error-box">${this._error}</div>`:tt}
        ${this._loading?X`<div class="loading-spinner">Fetching prices…</div>`:X`
          ${this._renderOtherCarsStatus()}
          ${this._renderCarSelector()}
          ${this._renderStatusPanel()}
          ${this._renderPriceStrip()}
          ${this._renderNextCharge()}
          ${this._renderModeSelector()}
          ${this._renderSettings()}
          ${this._renderEstimate()}
          ${this._renderSmartTip()}
          ${this._renderExecuteButton()}
          ${this._renderCombinedChart()}
          ${this._renderTableToggle()}
        `}
      </ha-card>
    `:tt}_renderHeader(){return X`
      <div class="card-header">
        <span class="card-title">EV Charge Planner</span>
        <button class="refresh-btn" @click=${this._onRefresh} title="Refresh prices">
          &#x21BB;
        </button>
      </div>
    `}_renderCarSelector(){return this._cars.length<=1?tt:X`
      <div class="car-selector">
        <select @change=${this._onCarChange} .value=${this._selectedCarId}>
          ${this._cars.map(t=>X`<option value=${t.id} ?selected=${t.id===this._selectedCarId}>${t.name}</option>`)}
        </select>
      </div>
    `}_renderStatusPanel(){const t=this._selectedCar,e=this._currentSoC,s=!!t?.soc_entity&&null!==getLiveSoC(this.hass,t.soc_entity),r=t?.soc_entity?.replace("battery_level","ev_range"),o=r?parseFloat(this.hass?.states[r]?.state):null,l=t?.plug_entity?this.hass?.states[t.plug_entity]?.state:null,h=t?.power_entity?parseFloat(this.hass?.states[t.power_entity]?.state):null;return X`
      <div class="status-panel">
        <div class="stat-card">
          <div class="stat-value">${null!=e?Math.round(e):"–"}%</div>
          <div class="stat-label">Battery</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${null==o||isNaN(o)?"–":Math.round(o)} km</div>
          <div class="stat-label">Range</div>
        </div>

        <div class="soc-bar-wrap">
          <div class="soc-bar-label">
            <span>${t?.name??"Car"}</span>
            <span>${"on"===l?h&&h>0?`Charging ${h} kW`:"Connected":"Not connected"}</span>
          </div>
          <div class="soc-bar">
            <div class="soc-bar-fill ${this._socBarClass(e)}" style="width:${Math.max(0,Math.min(100,e??0))}%"></div>
          </div>
        </div>

        ${s?tt:X`
          <div class="manual-soc-row">
            <label>Manual SoC (no HA integration)</label>
            <input type="range" min="0" max="100" step="1"
              .value=${String(this._settings?.manual_soc??20)}
              @input=${t=>this._onSettingChange("manual_soc",parseInt(t.target.value))}
            />
            <div class="manual-soc-value">${this._settings?.manual_soc??20}%</div>
          </div>
          <div class="no-integration-note">No HA integration — charger cannot be controlled automatically</div>
        `}
      </div>
    `}_renderModeSelector(){const t=this._settings?.mode??"Cheapest Hours";return X`
      <div class="section-label">Charging Mode</div>
      <div class="mode-grid">
        ${dt.map(e=>X`
            <button class="mode-btn ${t===e?"active":""}" @click=${()=>this._onModeChange(e)}>
              ${e}
            </button>
          `)}
      </div>
    `}_renderSettings(){const t=this._settings?.mode;return t&&"Charge Now"!==t&&"Off"!==t?X`
      <div class="settings-panel">
        ${"Cheapest Hours"===t?X`
          <div class="setting-row">
            <label>Cheapest hours <span>${this._settings.cheapest_hours} hrs</span></label>
            <input type="range" min="1" max="12" step="1"
              .value=${String(this._settings.cheapest_hours??4)}
              @input=${t=>this._onSettingChange("cheapest_hours",parseInt(t.target.value))}
            />
          </div>
        `:tt}

        ${"Below Threshold"===t?X`
          <div class="setting-row">
            <label>Price ceiling <span>${this._fmt(this._settings.price_threshold)} DKK/kWh</span></label>
            <input type="range" min="0.10" max="5.00" step="0.05"
              .value=${String(this._settings.price_threshold??.5)}
              @input=${t=>this._onSettingChange("price_threshold",parseFloat(t.target.value))}
            />
          </div>
        `:tt}

        ${"Departure Plan"===t?X`
          <div class="setting-row">
            <label>Departure time</label>
            <input type="time"
              .value=${this._settings.departure_time??"07:00"}
              @change=${t=>this._onSettingChange("departure_time",t.target.value)}
            />
          </div>
          <div class="setting-row">
            <label>Target SoC at departure <span>${this._settings.target_soc??80}%</span></label>
            <input type="range" min="30" max="100" step="5"
              .value=${String(this._settings.target_soc??80)}
              @input=${t=>this._onSettingChange("target_soc",parseInt(t.target.value))}
            />
          </div>
        `:tt}

        ${this._selectedCar?.charge_limit_entity?X`
          <div class="setting-row">
            <label>AC charge limit <span>${this._settings.charge_limit??80}%</span></label>
            <input type="range" min="50" max="100" step="5"
              .value=${String(this._settings.charge_limit??80)}
              @input=${t=>this._onChargeLimitChange(parseInt(t.target.value))}
            />
          </div>
        `:tt}
      </div>
    `:tt}_renderEstimate(){if(!this._summary||0===this._plan.length)return X`<div class="estimate-box loading">No charge plan — refresh or select a mode.</div>`;const{kwh_added:t,final_soc:e,total_cost:s,cheapest_slot:r,priciest_slot:o,avg_ep:l}=this._summary,h=this._settings?.mode,d=this._settings?.departure_time??"07:00",[p,g]=d.split(":").map(Number),u=new Date;u.setHours(p,g,0,0),u<=new Date&&u.setDate(u.getDate()+1);const m=u.toLocaleString("en-GB",{weekday:"short",hour:"2-digit",minute:"2-digit"}),_=this._selectedCar,f=_?.charge_kw??this.config?.charger_speed_kw??9.5,v=this._plan.filter(t=>t.charging&&!t.isPast).length,$=(o?o.ep*f*v/4:0)-s;return X`
      <div class="estimate-box">
        <div class="estimate-title">
          ${"Departure Plan"===h?`Estimate — depart ${m}`:"Estimate — from now"}
        </div>
        <div class="estimate-main">+${this._fmt(t,1)} kWh → ${Math.round(e)}% SoC</div>
        <div class="estimate-sub">Estimated cost: ~${this._fmt(s)} DKK
          ${$>.01?X` · <span class="savings">save ~${this._fmt($)} DKK vs. peak hours</span>`:tt}
        </div>
        <div class="estimate-stats">
          <span class="estimate-stat">Cheapest: ${this._fmt(r?.ep)} DKK/kWh (${r?this._formatTime(r.start):"–"})</span>
          <span class="estimate-stat">Most exp.: ${this._fmt(o?.ep)} DKK/kWh</span>
          <span class="estimate-stat">Avg: ${this._fmt(l)} DKK/kWh</span>
        </div>
      </div>
    `}_renderTimeline(){if(0===this._plan.length)return tt;const t=this._plan,e=t.map(t=>t.ep),s=Math.min(...e),r=Math.max(...e),o=new Date,l=o.toDateString(),h=t.filter(t=>t.localDate.toDateString()===l),d=t.filter(t=>t.localDate.toDateString()!==l),renderBar=t=>t.map(t=>{const e=r>s?(t.ep-s)/(r-s):0,l=t.localDate<=o&&o<new Date(t.localDate.getTime()+9e5);return X`<div
        class="timeline-slot ${t.isPast?"past":""} ${t.charging?"charging":""} ${t.charging&&e<.33?"cheap":""} ${t.charging&&e>.66?"peak":""}"
        title="${this._formatTime(t.start)}: ${this._fmt(t.ep)} DKK/kWh${t.charging?" – charging":""}${t.isPast?" (past)":""}"
        style="${l?"outline: 2px solid var(--primary-text-color);":""}"
      ></div>`}),renderLabels=t=>{const e=[];for(let s=0;s<t.length;s+=4)e.push(t[s].localDate.getHours().toString().padStart(2,"0"));const s=Math.ceil(e.length/6);return X`<div class="timeline-labels">
        ${e.filter((t,r)=>r%s===0||r===e.length-1).map(t=>X`<span>${t}</span>`)}
      </div>`};return X`
      <div class="timeline-wrap">
        <div class="section-label">Charge Plan</div>
        ${h.length?X`
          <div class="timeline-day-label">${o.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} (today)</div>
          <div class="timeline-bar">${renderBar(h)}</div>
          ${renderLabels(h)}
        `:tt}
        ${d.length?X`
          <div class="timeline-day-label">${d[0].localDate.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} (tomorrow)</div>
          <div class="timeline-bar">${renderBar(d)}</div>
          ${renderLabels(d)}
        `:X`<div class="estimate-sub" style="margin:4px 16px;opacity:.6">Tomorrow's prices available ~13:00</div>`}
      </div>

      <button class="table-toggle" @click=${()=>{this._showTable=!this._showTable}}>
        ${this._showTable?"Hide 15-min plan":"Show 15-min plan"}
      </button>

      ${this._showTable?this._renderTable(t,o):tt}
    `}_renderTable(t,e){let s=null;return X`
      <table class="price-table">
        <thead>
          <tr><th>Time</th><th>DKK/kWh</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${t.map(t=>{const r=t.localDate.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}),o=r!==s?(s=r,X`<tr class="day-header-row"><td colspan="3">${r}</td></tr>`):tt,l=t.localDate<=e&&e<new Date(t.localDate.getTime()+9e5);return X`
              ${o}
              <tr class="${t.isPast?"past-row":""} ${t.charging?"charging-row":""} ${l?"now-row":""}">
                <td>${this._formatTime(t.start)}${l?" ◀":""}</td>
                <td>${this._fmt(t.ep)}</td>
                <td>${t.isPast?X`<span style="opacity:.4">–</span>`:t.charging?X`<span class="charge-dot"></span>Charging`:"–"}</td>
              </tr>
            `})}
        </tbody>
      </table>
    `}_renderExecuteButton(){if(!this._selectedCar?.charging_switch)return tt;const t=this._settings?.mode;if("Off"===t)return tt;const e=this._selectedCar,s=!e.plug_entity||"on"===this.hass?.states[e.plug_entity]?.state,r=this._lastAction?.startsWith("▶")?"action-started":this._lastAction?.startsWith("⏸")?"action-stopped":this._lastAction?.startsWith("✓")?"action-ok":this._lastAction?"action-idle":"";return X`
      <div class="execute-wrap">
        <button class="execute-btn ${this._executing?"executing":""}"
          @click=${this._onExecutePlan}
          ?disabled=${this._executing||!this._plan.length||!s}>
          ${s?this._executing?"⏳ Running…":"▶ Execute plan now":"🔌 Car not connected"}
        </button>
        ${this._lastAction?X`<div class="action-status ${r}">${this._lastAction}</div>`:tt}
        <div class="auto-note">Runs automatically every 5 minutes</div>
      </div>
    `}_renderPriceStrip(){if(!this._plan.length)return tt;const t=new Date,e=this._plan.filter(e=>e.localDate.toDateString()===t.toDateString()),s=e.find(e=>t>=e.localDate&&t<new Date(e.localDate.getTime()+9e5)),r=e.length?Math.min(...e.map(t=>t.ep)):null,o=e.length?Math.max(...e.map(t=>t.ep)):null,l=s?.ep??null,h=null!=l&&null!=r&&null!=o&&o>r?Math.round((l-r)/(o-r)*100):null,d=null!=h?h<33?"price-cheap":h<66?"price-mid":"price-peak":"";return X`
      <div class="price-strip">
        <div class="price-strip-item ${d}">
          <div class="ps-label">Now</div>
          <div class="ps-value">${null!=l?this._fmt(l):"–"}</div>
          <div class="ps-unit">DKK/kWh</div>
        </div>
        <div class="price-strip-divider"></div>
        <div class="price-strip-item price-cheap">
          <div class="ps-label">Lowest today</div>
          <div class="ps-value">${null!=r?this._fmt(r):"–"}</div>
          <div class="ps-unit">DKK/kWh</div>
        </div>
        <div class="price-strip-divider"></div>
        <div class="price-strip-item price-peak">
          <div class="ps-label">Highest today</div>
          <div class="ps-value">${null!=o?this._fmt(o):"–"}</div>
          <div class="ps-unit">DKK/kWh</div>
        </div>
        ${null!=h?X`
        <div class="price-strip-divider"></div>
        <div class="price-strip-item">
          <div class="ps-label">Price rank</div>
          <div class="ps-value ${d}">${h}%</div>
          <div class="ps-unit">of today's range</div>
        </div>`:tt}
      </div>
      <div class="price-chip-note">All prices incl. N1 Nettarif C + Energinet tariffs</div>
    `}_renderNextCharge(){if(!this._plan.length||"Off"===this._settings?.mode)return tt;const t=new Date,e=this._plan.find(e=>t>=e.localDate&&t<new Date(e.localDate.getTime()+9e5));if(e?.charging){const e=this._plan.find(e=>!e.isPast&&!e.charging&&e.localDate>t),s=e?this._formatTime(e.start):"–";return X`<div class="next-charge charging-now">⚡ Charging now — stops ~${s}</div>`}const s=this._plan.find(e=>!e.isPast&&e.charging&&e.localDate>t);if(!s)return X`<div class="next-charge">No charging scheduled</div>`;const r=s.localDate-t,o=Math.floor(r/36e5),l=Math.floor(r%36e5/6e4),h=o>0?`${o}h ${l}min`:`${l} min`,d=s.localDate.toDateString()!==t.toDateString();return X`<div class="next-charge">
      ⏱ Next charge ${d?"tomorrow ":""}at ${this._formatTime(s.start)} — in ${h} (${this._fmt(s.ep)} DKK/kWh)
    </div>`}_renderSmartTip(){if(!this._plan.length||!this._summary)return tt;const t=new Date,e=this._settings?.mode,s=this._plan.filter(e=>!e.isPast&&e.localDate.toDateString()===t.toDateString()),r=this._plan.find(e=>t>=e.localDate&&t<new Date(e.localDate.getTime()+9e5)),o=[...s].sort((t,e)=>t.ep-e.ep),l=o.slice(0,3),h=o[Math.floor(.25*o.length)]?.ep;if(r&&!r.charging&&r.ep<=(h??1/0)&&"Charge Now"!==e)return X`<div class="smart-tip">💡 Current price (${this._fmt(r.ep)} DKK/kWh) is in the cheapest 25% today — consider switching to Charge Now or adding more hours.</div>`;const d=l.find(e=>!e.charging&&e.localDate>t&&e.localDate-t<108e5);if(d&&"Off"===e)return X`<div class="smart-tip">💡 Cheap price window at ${this._formatTime(d.start)} (${this._fmt(d.ep)} DKK/kWh) — enable a charging mode to take advantage.</div>`;if("Cheapest Hours"===e&&this._summary.final_soc<(this._settings?.charge_limit??100)-5){const t=l.filter(t=>!t.charging);if(t.length)return X`<div class="smart-tip">💡 Battery will reach ${Math.round(this._summary.final_soc)}% — increase Cheapest Hours to charge more during the cheap window (${this._fmt(t[0].ep)} DKK/kWh at ${this._formatTime(t[0].start)}).</div>`}return tt}_renderCombinedChart(){if(!this._plan.length)return tt;const t=this._plan,e=new Date,s=this._selectedCar,r=s?.battery_kwh??71.2,o=s?.charge_kw??9.5,l=this._settings?.charge_limit??100,h=this._currentSoC??this._settings?.manual_soc??20,d=46,p=12,g=908,u=188,m=t.map(t=>t.ep),_=Math.min(...m),f=Math.max(...m),v=.1*(f-_)||.1,$=_-v,x=f+v,b=t[0].localDate.getTime(),w=t[t.length-1].localDate.getTime()+9e5,C=w-b,A=g/t.length,toX=t=>d+(t-b)/C*g,epToY=t=>200-(t-$)/(x-$)*u,socToY=t=>200-Math.min(100,Math.max(0,t))/100*u;let D=h;const E=[];for(let s=0;s<t.length;s++){const h=t[s];h.isPast||(0===E.length&&E.push([toX(e.getTime()),socToY(D)]),E.push([d+(s+.5)*A,socToY(D)]),h.charging&&(D=Math.min(l,D+.25*o/r*100)))}E.length&&E.push([d+t.length*A,socToY(D)]);const P=E.map(([t,e],s)=>`${0===s?"M":"L"}${t.toFixed(1)},${e.toFixed(1)}`).join(" "),T=[];let F=null;t.forEach((t,e)=>{const s=t.localDate.toDateString();s!==F&&(F&&T.push({x:d+e*A,label:t.localDate.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}),F=s)});const O=[];t.forEach((t,e)=>{0===t.localDate.getMinutes()&&t.localDate.getHours()%3==0&&O.push({x:d+e*A,label:t.localDate.getHours().toString().padStart(2,"0")+":00"})});const K=[_,(_+f)/2,f],U=toX(e.getTime()),B=e.getTime()>=b&&e.getTime()<=w;return X`
      <div class="combined-chart-wrap">
        <div class="section-label">Price & Charge Plan</div>
        <svg viewBox="0 0 ${1e3} ${230}" class="combined-svg" xmlns="http://www.w3.org/2000/svg">

          <!-- Grid lines -->
          ${K.map(t=>X`<line
            x1="${d}" y1="${epToY(t).toFixed(1)}"
            x2="${954}" y2="${epToY(t).toFixed(1)}"
            stroke="currentColor" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.15"/>`)}

          <!-- SoC grid lines -->
          ${[25,50,75,100].map(t=>X`<line
            x1="${d}" y1="${socToY(t).toFixed(1)}"
            x2="${954}" y2="${socToY(t).toFixed(1)}"
            stroke="#2196f3" stroke-width="0.3" stroke-dasharray="2,6" opacity="0.2"/>`)}

          <!-- Price bars -->
          ${t.map((t,s)=>{const r=d+s*A,o=Math.max(2,(t.ep-$)/(x-$)*u),l=200-o,h=t.localDate<=e&&e<new Date(t.localDate.getTime()+9e5),g=t.charging?t.ep<_+.33*(f-_)?"#4caf50":t.ep>_+.66*(f-_)?"#ff9800":"#66bb6a":"currentColor";return X`<rect
              x="${r.toFixed(1)}" y="${l.toFixed(1)}"
              width="${Math.max(.5,A-.8).toFixed(1)}" height="${o.toFixed(1)}"
              fill="${g}" opacity="${t.isPast?.2:t.charging?.95:.35}"
              rx="1">
              <title>${this._formatTime(t.start)}: ${this._fmt(t.ep)} DKK/kWh${t.charging?" ⚡ charging":""}</title>
            </rect>
            ${h?X`<rect x="${r.toFixed(1)}" y="${p}" width="${A.toFixed(1)}" height="${u}"
              fill="none" stroke="white" stroke-width="1.5" opacity="0.6" rx="1"/>`:tt}`})}

          <!-- Day separators -->
          ${T.map(t=>X`
            <line x1="${t.x.toFixed(1)}" y1="${p}" x2="${t.x.toFixed(1)}" y2="${200}"
              stroke="currentColor" stroke-width="1" stroke-dasharray="3,3" opacity="0.3"/>
            <text x="${(t.x+5).toFixed(1)}" y="${26..toFixed(1)}"
              font-size="16" fill="currentColor" opacity="0.5">${t.label}</text>`)}

          <!-- Current time line -->
          ${B?X`
            <line x1="${U.toFixed(1)}" y1="${p}" x2="${U.toFixed(1)}" y2="${204}"
              stroke="white" stroke-width="2" opacity="0.8"/>`:tt}

          <!-- Charge limit dashed line -->
          <line x1="${d}" y1="${socToY(l).toFixed(1)}"
            x2="${954}" y2="${socToY(l).toFixed(1)}"
            stroke="#2196f3" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.5"/>
          <text x="${957..toFixed(1)}" y="${(socToY(l)+5).toFixed(1)}"
            font-size="15" fill="#2196f3" opacity="0.8">${l}%</text>

          <!-- SoC projection line -->
          ${P?X`<path d="${P}" fill="none" stroke="#2196f3" stroke-width="3"
            stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`:tt}

          <!-- Current SoC dot -->
          ${B&&E.length?X`<circle
            cx="${E[0][0].toFixed(1)}" cy="${E[0][1].toFixed(1)}"
            r="5" fill="#2196f3" opacity="0.9"/>`:tt}

          <!-- Left Y-axis: price -->
          ${K.map(t=>X`<text
            x="${42..toFixed(1)}" y="${(epToY(t)+4).toFixed(1)}"
            font-size="16" fill="currentColor" text-anchor="end" opacity="0.6">${t.toFixed(1)}</text>`)}
          <text x="${42..toFixed(1)}" y="${10..toFixed(1)}"
            font-size="13" fill="currentColor" text-anchor="end" opacity="0.45">DKK</text>

          <!-- Right Y-axis: SoC -->
          ${[0,50,100].map(t=>X`<text
            x="${958..toFixed(1)}" y="${(socToY(t)+4).toFixed(1)}"
            font-size="16" fill="#2196f3" opacity="0.7">${t}%</text>`)}
          <text x="${958..toFixed(1)}" y="${10..toFixed(1)}"
            font-size="13" fill="#2196f3" opacity="0.45">SoC</text>

          <!-- X-axis labels -->
          ${O.map(t=>X`<text
            x="${t.x.toFixed(1)}" y="${220..toFixed(1)}"
            font-size="16" fill="currentColor" text-anchor="middle" opacity="0.5">${t.label}</text>`)}
        </svg>

        <div class="chart-legend">
          <span class="legend-item"><span class="legend-swatch" style="background:#4caf50"></span>Charging (cheap)</span>
          <span class="legend-item"><span class="legend-swatch" style="background:#ff9800"></span>Charging (peak)</span>
          <span class="legend-item"><span class="legend-swatch" style="background:currentColor;opacity:.35"></span>Not charging</span>
          <span class="legend-item"><span class="legend-line-swatch"></span>SoC projection</span>
        </div>
      </div>

      <button class="table-toggle" @click=${()=>{this._showTable=!this._showTable}}>
        ${this._showTable?"Hide 15-min schedule":"Show 15-min schedule"}
      </button>
      ${this._showTable?this._renderTable():tt}
    `}_renderTableToggle(){return tt}_renderTable(){const t=new Date;let e=null;return X`
      <table class="price-table">
        <thead><tr><th>Time</th><th>DKK/kWh</th><th>Status</th></tr></thead>
        <tbody>
          ${this._plan.map(s=>{const r=s.localDate.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}),o=r!==e?(e=r,X`<tr class="day-header-row"><td colspan="3">${r}</td></tr>`):tt,l=s.localDate<=t&&t<new Date(s.localDate.getTime()+9e5);return X`${o}
              <tr class="${s.isPast?"past-row":""} ${s.charging?"charging-row":""} ${l?"now-row":""}">
                <td>${this._formatTime(s.start)}${l?" ◀":""}</td>
                <td>${this._fmt(s.ep)}</td>
                <td>${s.isPast?X`<span style="opacity:.4">–</span>`:s.charging?X`<span class="charge-dot"></span>Charging`:"–"}</td>
              </tr>`})}
        </tbody>
      </table>`}_renderPriceChart(){return tt}_renderTimeline(){return tt}_renderPriceWidget(){return tt}getCardSize(){return 8}}),window.customCards=window.customCards||[],window.customCards.push({type:"ev-smart-charging-card",name:"EV Smart Charging Denmark",description:"Smart EV charging scheduler with Danish Nord Pool prices, N1 tariffs, and departure planning.",preview:!1,documentationURL:"https://github.com/graphen007/ev-charger-denmark-schedule-HACS"}),console.info("%c EV-SMART-CHARGING-CARD %c v1.0.0 ","background:#4caf50;color:#fff;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px","background:#1e1e1e;color:#4caf50;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0");
