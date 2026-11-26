/* A qué resolución se dibuja la escena para ir a 60, sin DOM ni three (se prueba en Node).
   Los escalones van de 0 (la más fina) a n − 1. Si hay cronómetro de gráfica manda él. Si no (muchos móviles), se mira lo que tardan los
   fotogramas limpios (sin montar nada, sin cambiar de sitio) y, como eso no dice si lo lento es la gráfica o el procesador, se prueba: se baja y,
   si no mejora, se vuelve a donde estaba; y al revés, si va justo pero subir no lo empeora, se queda arriba. Nada de lo que se quita es para siempre. */
export class Ritmo {
  constructor({n, ini = 0, quitas = 0, holgura = 9.2}) {Object.assign(this, {n, holgura, k: Math.min(ini, n - 1), q: 0, nq: quitas, D: [], t0: 0, mal: 0, bien: 0, neu: 0, fin: 0, techo: 0, techoT: 0, subeT: -1e9, prueba: null, noBajar: 0, espera: 12000, pausa: 25000})}
  /* un fotograma: lo que ha tardado (ms) y si cuenta */
  foto(dt, limpio, now) {if (!limpio) {if (this.D.length && now - this.t0 > 4000) this.D.length = 0; return} if (!this.D.length) this.t0 = now; this.D.push(dt)}
  get lista() {return this.D.length >= 45}
  /* se cambia de sitio: lo medido ya no vale */
  olvida() {if (this.prueba) {this.k = this.prueba.k; if (this.prueba.q !== undefined) this.q = this.prueba.q} this.D.length = 0; this.mal = this.bien = this.neu = 0; this.prueba = null}
  /* va regular y no se sabe de quién es la culpa: se sube un escalón y en la ventana siguiente se mira si ha empeorado */
  tienta(med, no) {if (no || this.q || this.k <= this.techo || ++this.neu < 3) return false; this.neu = 0; this.prueba = {k: this.k, med, sube: true}; this.k--; return true}
  /* cierra la ventana: g, ms de gráfica (0: no se sabe); z: cuánto dura un fotograma de esta pantalla respecto a 60 Hz. Devuelve true si cambia algo */
  cierra(now, {g = 0, z = 1, tocando = false, tope = false} = {}) {
    const D = this.D.map(x => x / z).sort((a, b) => a - b); this.D.length = 0; const m = D.slice(0, Math.ceil(D.length * .94)), med = m.reduce((a, b) => a + b, 0) / m.length, lentos = D.filter(x => x > 22).length / D.length; this.med = med; g /= z;
    const malo = g ? g > 13.6 || (med > 18.6 && g > 10.5) : med > 18.9 || lentos > .3, bueno = g ? g < this.holgura && med < 17.8 : med < 17.6 && lentos < .07, k0 = this.k, q0 = this.q;
    if (this.prueba) {const p = this.prueba; this.prueba = null; if (p.sube) {if (med > p.med * 1.06) {/* subir sí se nota: la gráfica va justa */ this.k = p.k; this.techo = p.k; this.techoT = now + this.pausa; this.pausa = Math.min(180000, this.pausa * 2); this.mal = this.bien = this.neu = 0; return true} if (now > this.techoT) this.techo = 0} else if (med > p.med * .9 && !(med < 17.6 && p.med > 18.9)) {/* dibujar menos no ha servido: no era la gráfica */ this.k = p.k; this.q = p.q; this.noBajar = now + this.espera; this.espera = Math.min(120000, this.espera * 2); this.mal = this.bien = 0; return true}}
    if (malo) {
      this.bien = 0; if (!g && now < this.noBajar) return this.tienta(med, tocando || tope); if (!g && ++this.mal < 2) return false; this.mal = 0;
      if (now - this.subeT < 5000) {this.techo = Math.min(this.n - 1, this.k + 1); this.techoT = now + this.pausa; this.pausa = Math.min(180000, this.pausa * 2)}
      if (this.k < this.n - 1) {this.fin = 0; this.k = Math.min(this.n - 1, this.k + (g ? g > 19 ? 3 : g > 16 ? 2 : 1 : med > 21 ? 3 : 2))} else if (this.q < this.nq && ++this.fin > 1) {this.fin = 0; this.q++}
      if (!g && (this.k !== k0 || this.q !== q0)) this.prueba = {k: k0, q: q0, med};
    } else if (bueno && !tocando && !tope) {
      this.mal = 0; if (now > this.techoT) this.techo = 0; this.bien++;
      if (this.q > 0 && this.bien >= 4) {this.q--; this.bien = 0; this.subeT = now} else if (this.q === 0 && this.k > this.techo && this.bien >= (g ? 2 : 3)) {this.k--; this.bien = 0; this.subeT = now}
    } else {this.mal = 0; if (!g && !bueno) return this.tienta(med, tocando || tope)}
    return this.k !== k0 || this.q !== q0;
  }
}
