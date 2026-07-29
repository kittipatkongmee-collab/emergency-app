[CmdletBinding(SupportsShouldProcess)]
param()
$ErrorActionPreference = 'Stop'
if ($PSCmdlet.ShouldProcess('local police_incidents database', 'reset and reseed')) {
  pnpm --filter @police/api exec prisma migrate reset --force
}
