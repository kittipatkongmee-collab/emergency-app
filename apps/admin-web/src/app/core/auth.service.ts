import {computed,Injectable,signal} from '@angular/core';
import {Router} from '@angular/router';
import {tap} from 'rxjs';
import {ApiService} from './api.service';
import {Tokens} from './models';
@Injectable({providedIn:'root'})
export class AuthService{
 private readonly key='police.admin.access';
 readonly accessToken=signal(sessionStorage.getItem(this.key)??localStorage.getItem(this.key));
 readonly authenticated=computed(()=>Boolean(this.accessToken()));
 constructor(private readonly api:ApiService,private readonly router:Router){}
 login(username:string,password:string,rememberMe:boolean){return this.api.post<Tokens>('admin/auth/login',{username,password,rememberMe}).pipe(tap(tokens=>{const storage=rememberMe?localStorage:sessionStorage;storage.setItem(this.key,tokens.accessToken);storage.setItem('police.admin.refresh',tokens.refreshToken);this.accessToken.set(tokens.accessToken)}))}
 logout(){localStorage.removeItem(this.key);sessionStorage.removeItem(this.key);localStorage.removeItem('police.admin.refresh');sessionStorage.removeItem('police.admin.refresh');this.accessToken.set(null);void this.router.navigateByUrl('/login')}
}
