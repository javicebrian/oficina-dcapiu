const nf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const m2 = (v: number) => `${nf.format(v)} m²`
export const m = (cm: number) => `${nf.format(cm / 100)} m`
