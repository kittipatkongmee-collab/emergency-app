import{ChangeDetectionStrategy,Component,signal}from'@angular/core';
import{RouterLink,RouterLinkActive,RouterOutlet}from'@angular/router';
import{AuthService}from'../core/auth.service';
@Component({standalone:true,imports:[RouterLink,RouterLinkActive,RouterOutlet],templateUrl:'./shell.html',styleUrl:'./shell.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class ShellComponent{
 readonly open=signal(false);readonly now=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(new Date());
 readonly menu=[['⌂','แดชบอร์ด','/dashboard'],['☷','รายการแจ้งเหตุ','/incidents'],['⌖','แผนที่เหตุการณ์','/map'],['♙','ผู้ใช้งาน','/users'],['♢','การแจ้งเตือน','/notifications'],['◴','ประวัติการดำเนินการ','/audit'],['⚙','ตั้งค่าระบบ','/settings']];
 constructor(readonly auth:AuthService){}
}
