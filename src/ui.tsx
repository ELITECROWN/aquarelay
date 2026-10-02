import {createContext,useContext,useState,type ReactNode} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {X,Info,ArrowUpRight} from 'lucide-react';
import {Link} from 'react-router-dom';
const ToastContext=createContext<(message:string)=>void>(()=>{});
export const useToast=()=>useContext(ToastContext);
export function ToastProvider({children}:{children:ReactNode}){const [message,setMessage]=useState('');function toast(value:string){setMessage(value);window.setTimeout(()=>setMessage(''),5000)}return <ToastContext.Provider value={toast}>{children}{message&&<div className="toast" role="status"><Info size={18}/>{message}<button aria-label="Dismiss notification" onClick={()=>setMessage('')}><X size={16}/></button></div>}</ToastContext.Provider>}
export function Badge({children,state='neutral'}:{children:ReactNode;state?:string}){return <span className={`badge badge-${state.toLowerCase().replaceAll(' ','_')}`}>{children}</span>}
export function Empty({title,children}:{title:string;children?:ReactNode}){return <div className="empty"><Info size={25}/><h3>{title}</h3>{children&&<p>{children}</p>}</div>}
export function PageHeader({eyebrow,title,description,children}:{eyebrow?:string;title:string;description?:string;children?:ReactNode}){return <header className="page-heading"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{children}</header>}
export function Modal({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:ReactNode}){return <Dialog.Root open={open} onOpenChange={v=>{if(!v)onClose()}}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal"><Dialog.Title>{title}</Dialog.Title><Dialog.Description className="sr-only">{title} controls and options</Dialog.Description><Dialog.Close className="modal-close" aria-label="Close"><X size={20}/></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>}
export function formatDate(value?:string){if(!value)return 'Not recorded';return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(value));}
export function RecordLink({to,children}:{to:string;children:ReactNode}){return <Link className="text-link" to={to}>{children}<ArrowUpRight size={15}/></Link>}
