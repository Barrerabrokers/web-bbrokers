// Opt-in integration checks run separately so their asynchronous work finishes
// before Next builds. Normal deployments only run the application build.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const [flag,script] of [
 ['MIA_CAMPAIGN_SMOKE','verify-mia-campaign.cjs'],
 ['MIA_PROJECT_SELECTION_SMOKE','verify-mia-project-selection.cjs'],
 ['MIA_WHATSAPP_TEMPLATE_SETUP','setup-mia-whatsapp-template.cjs'],
 ['MIA_WHATSAPP_ACCOUNT_DISCOVERY','discover-mia-whatsapp-account.cjs'],
 ['MIA_ASSIGNMENT_SMOKE','verify-mia-assignment.cjs'],
 ['MIA_SALES_PILOT_SMOKE','verify-mia-sales-pilot.cjs'],
 ['AGENT_DASHBOARD_SMOKE','verify-agent-dashboard.cjs'],
 ['MIA_AGENT_SMOKE','verify-mia-agent.cjs'],
 ['MIA_CONTINUITY_SMOKE','verify-mia-continuity.cjs'],
 ['MIA_PROVIDER_SMOKE','verify-mia-provider-recovery.cjs'],
 ['MIA_MEETING_SMOKE','verify-mia-calendar.cjs'],
 ['MIA_DIALOGUE_SMOKE','verify-mia-dialogue.cjs'],
 ['MIA_TRIAL_SMOKE','verify-mia-project-trial.cjs'],
]){
 if(process.env[flag]!=='1')continue;
 const result=spawnSync(process.execPath,[path.join(__dirname,script)],{stdio:'inherit',env:process.env});
 if(result.error||result.status!==0){console.error('Build verification failed:',flag);process.exit(result.status||1);}
}
