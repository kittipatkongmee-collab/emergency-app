export interface ApiEnvelope<T>{success:boolean;data:T;meta:Record<string,unknown>}
export interface Tokens{accessToken:string;refreshToken:string;expiresIn:string}
export interface Summary{total:number;pending:number;active:number;completed:number}
export interface IncidentImage{id:string;imageUrl:string;originalName:string}
export interface StatusHistory{id:string;toStatus:string;note?:string;changedAt:string;changedByAdminUser?:{fullName:string}}
export interface Incident{id:string;caseCode:string;reporterName:string;reporterPhone:string;type:string;description:string;latitude:string;longitude:string;address:string;province?:string;status:string;priority:string;reportedAt:string;images:IncidentImage[];statusHistory?:StatusHistory[];assignedAdminUser?:{id:string;fullName:string}}
export interface IncidentPage{items:Incident[];pagination:{page:number;limit:number;total:number;totalPages:number}}
