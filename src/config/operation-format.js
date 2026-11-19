export const money=cents=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(cents)/100)
export const dateTime=value=>new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})
export const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10)
