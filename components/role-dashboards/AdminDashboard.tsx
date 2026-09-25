import { CommandShell, Exceptions, FleetTotals, DecisionActions, type CommandCentreProps } from './CommandCentre'
import { IntelligenceBrief } from '@/components/intelligence/IntelligenceBrief'
import { DataQualityCard } from '@/components/intelligence/DataQualityCard'
import ActivityFeed from '@/components/ActivityFeed'
import { SetupChecklist } from '@/components/onboarding/SetupChecklist'
import { useState } from 'react'
export default function AdminDashboard(props: CommandCentreProps) { const [showSetup,setShowSetup]=useState(!props.onboardingCompleted); return <CommandShell title="Owner command centre" partial={props.partial} retry={props.retry} availability={props.availability} restricted={props.restricted}>{showSetup&&<SetupChecklist onDismiss={()=>setShowSetup(false)}/>}<IntelligenceBrief/><Exceptions {...props}/><DecisionActions {...props}/><DataQualityCard/><FleetTotals {...props}/><ActivityFeed limit={5}/></CommandShell> }
