import { useState } from 'react'
import { Feedback } from '../components/ui/Feedback'
import { apiErrorMessage } from '../api/client'

export function useAction() {
  const [pending,setPending]=useState(false),[message,setMessage]=useState(null)
  async function run(fn) {
    setPending(true);setMessage(null)
    try {const text=await fn();if(text)setMessage({tone:'success',text})}
    catch(err){setMessage({tone:'error',text:apiErrorMessage(err)})}
    finally{setPending(false)}
  }
  return {run,pending,feedback:message && <Feedback tone={message.tone}>{message.text}</Feedback>}
}
