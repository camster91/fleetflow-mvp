import type { TeamRole } from '@/types'

export const isDriverRole = (role: TeamRole | string) => role === 'DRIVER'
export const assignedResourceWhere = (resourceWhere: object, role: TeamRole | string, userId: string) =>
  isDriverRole(role) ? { AND: [resourceWhere, { assignedDriverId: userId }] } : resourceWhere
export const assignedMaintenanceWhere = (resourceWhere: object, role: TeamRole | string, userId: string) =>
  isDriverRole(role) ? { AND: [resourceWhere, { vehicle: { assignedDriverId: userId } }] } : resourceWhere

type SafeRecord = Record<string, unknown>
export const DRIVER_DELIVERY_SELECT = { id:true,address:true,customer:true,status:true,driver:true,assignedDriverId:true,items:true,progress:true,scheduledTime:true,estimatedArrival:true,parkingInstructions:true,dropoffInstructions:true } as const
export const DRIVER_VEHICLE_SELECT = { id:true,name:true,status:true,driver:true,assignedDriverId:true,location:true,eta:true,mileage:true,maintenanceDue:true,vehicleType:true,licensePlate:true,fuelLevel:true,nextService:true } as const
export const DRIVER_MAINTENANCE_SELECT = { id:true,vehicleName:true,vehicleId:true,title:true,type:true,dueDate:true,priority:true,completed:true,vehicle:{select:{name:true}} } as const
export function driverDeliveryDto(delivery: SafeRecord) {
  return { id:delivery.id,address:delivery.address,customer:delivery.customer,status:delivery.status,driver:delivery.driver ?? '',assignedDriverId:delivery.assignedDriverId ?? null,items:delivery.items ?? 1,progress:delivery.progress ?? 0,scheduledTime:delivery.scheduledTime ?? null,estimatedArrival:delivery.estimatedArrival ?? null,parkingInstructions:delivery.parkingInstructions ?? null,dropoffInstructions:delivery.dropoffInstructions ?? null }
}
export function driverVehicleDto(vehicle: SafeRecord) {
  return { id:vehicle.id,name:vehicle.name,status:vehicle.status,driver:vehicle.driver ?? '',assignedDriverId:vehicle.assignedDriverId ?? null,location:vehicle.location ?? '',eta:vehicle.eta ?? '',mileage:vehicle.mileage ?? 0,maintenanceDue:vehicle.maintenanceDue ?? false,vehicleType:vehicle.vehicleType ?? null,licensePlate:vehicle.licensePlate ?? null,fuelLevel:vehicle.fuelLevel ?? null,nextService:vehicle.nextService ?? null }
}
export function driverMaintenanceDto(task: SafeRecord) {
  const vehicle = task.vehicle as { name?: string | null } | null | undefined
  return { id:task.id,vehicle:task.vehicleName ?? vehicle?.name ?? '',vehicleId:task.vehicleId ?? null,type:task.title ?? task.type ?? '',dueDate:task.dueDate ?? null,priority:task.priority ?? null,completed:task.completed ?? false }
}
