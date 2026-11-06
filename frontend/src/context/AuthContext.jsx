import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{let active=true;const init=async()=>{try{if(!localStorage.getItem('token'))return;const {data}=await api.get('/auth/me');if(active)setUser(data.user)}catch{localStorage.removeItem('token');localStorage.removeItem('user');if(active)setUser(null)}finally{if(active)setLoading(false)}};init();return()=>{active=false}},[])
  const persist=(payload)=>{const current=payload.user?{...payload.user,_id:payload.user.id||payload.user._id}:null;if(payload.token)localStorage.setItem('token',payload.token);if(current)localStorage.setItem('user',JSON.stringify(current));setUser(current);return current}
  const login=async(email,password)=>{const {data}=await api.post('/auth/login',{email,password});return persist(data)}
  const register=async(name,email,password)=>{const {data}=await api.post('/auth/register',{name,email,password});return persist(data)}
  const logout=()=>{localStorage.removeItem('token');localStorage.removeItem('user');setUser(null)}
  const updateProfile=async(profileData)=>{const {data}=await api.put('/auth/profile',profileData);const updated={...user,...data.user,_id:data.user?.id||user?._id};localStorage.setItem('user',JSON.stringify(updated));setUser(updated);return updated}
  return <AuthContext.Provider value={{user,token:localStorage.getItem('token'),login,register,logout,updateProfile,loading}}>{children}</AuthContext.Provider>
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context}
