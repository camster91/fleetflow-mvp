import React, { useState } from 'react';
import { 
  Truck, MapPin, Package, Clock, Navigation, 
  CheckCircle, AlertTriangle, Phone, MessageSquare,
  FileText, Battery, Wrench, Shield, Home
} from 'lucide-react';
import { notify, confirmAction, promptAction } from '../../services/notifications';

interface DeliveryAssignment {
  id: number;
  address: string;
  customer: string;
  items: number;
  timeWindow: string;
  status: 'pending' | 'in-progress' | 'completed';
  notes?: string;
}

interface VehicleInspection {
  id: number;
  item: string;
  status: 'ok' | 'needs-attention' | 'critical';
  notes?: string;
}

const DriverDashboard: React.FC = () => {
  const [currentDelivery, setCurrentDelivery] = useState<DeliveryAssignment | null>({
    id: 1,
    address: '123 Main St',
    customer: 'Restaurant A',
    items: 15,
    timeWindow: '10:00 AM - 11:00 AM',
    status: 'in-progress',
    notes: 'Deliver to back entrance'
  });

  const [vehicleStatus, setVehicleStatus] = useState({
    fuelLevel: 85,
    mileage: 45230,
    nextService: 500,
    issues: ['Left rear tire pressure low', 'Oil change due soon']
  });

  const [inspectionItems, setInspectionItems] = useState<VehicleInspection[]>([
    { id: 1, item: 'Tires & Pressure', status: 'needs-attention', notes: 'Left rear: 28 PSI' },
    { id: 2, item: 'Lights & Signals', status: 'ok' },
    { id: 3, item: 'Brakes', status: 'ok' },
    { id: 4, item: 'Fluid Levels', status: 'ok' },
    { id: 5, item: 'Safety Equipment', status: 'ok' },
  ]);

  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [sosActive, setSosActive] = useState(false);

  const handleCheckInOut = () => {
    if (isCheckedIn) {
      if (window.confirm('Are you sure you want to check out? This will end your shift.')) {
        setIsCheckedIn(false);
      }
    } else {
      setIsCheckedIn(true);
    }
  };

  const handleSOS = async () => {
    if (!sosActive) {
      const confirmed = await confirmAction(
        'Activate emergency SOS? This will notify dispatch and emergency contacts.',
        'Emergency SOS'
      );
      if (confirmed) {
        setSosActive(true);
        setTimeout(() => {
          notify.info(
            'SOS Activated! Help is on the way.\n\nDispatch has been notified.\nEmergency contacts have been alerted.\nYour location is being tracked.',
            { duration: 5000 }
          );
        }, 100);
      }
    } else {
      setSosActive(false);
      notify.info('SOS Deactivated. Emergency services notified.', { duration: 3000 });
    }
  };

  const handleStartNavigation = () => {
    if (currentDelivery) {
      const address = encodeURIComponent(currentDelivery.address);
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}&travelmode=driving`;
      notify.info(
        `Starting navigation to:\n${currentDelivery.address}\n\nCustomer: ${currentDelivery.customer}\nTime Window: ${currentDelivery.timeWindow}\nItems: ${currentDelivery.items}\n\nIn production, this would open Google Maps with turn-by-turn navigation.`,
        { duration: 5000 }
      );
      // window.open(mapsUrl, '_blank');
    }
  };

  const handleCompleteDelivery = async () => {
    if (currentDelivery) {
      const signature = await promptAction('Customer signature (type name for demo):');
      if (signature) {
        notify.info(
          `Delivery completed!\n\nCustomer: ${currentDelivery.customer}\nSignature: ${signature}\nTime: ${new Date().toLocaleTimeString()}\n\nProof of delivery recorded.`,
          { duration: 5000 }
        );
        setCurrentDelivery({
          ...currentDelivery,
          status: 'completed'
        });
      }
    }
  };

  const handleReportIssue = async () => {
    const issue = await promptAction('Describe the issue:');
    if (issue) {
      notify.info(
        `Issue reported:\n"${issue}"\n\nDispatch has been notified. Maintenance ticket created.`,
        { duration: 5000 }
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Driver Dashboard</h1>
              <p className="text-sm text-gray-600">John D. • Food Truck 1</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${isCheckedIn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {isCheckedIn ? 'On Duty' : 'Off Duty'}
          </div>
        </div>

        {/* Check In/Out Button */}
        <button
          onClick={handleCheckInOut}
          className={`w-full mt-4 py-3 rounded-lg font-medium ${isCheckedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white transition`}
        >
          {isCheckedIn ? 'Check Out' : 'Check In'}
        </button>
      </div>

      {/* Current Delivery */}
      {currentDelivery && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Delivery</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              currentDelivery.status === 'completed' ? 'bg-green-100 text-green-800' : 
              currentDelivery.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 
              'bg-yellow-100 text-yellow-800'
            }`}>
              {currentDelivery.status}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Package className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">{currentDelivery.customer}</p>
                <p className="text-sm text-gray-600">{currentDelivery.address}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Time Window</p>
                <p className="font-medium text-gray-900">{currentDelivery.timeWindow}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Package className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Items</p>
                <p className="font-medium text-gray-900">{currentDelivery.items} packages</p>
              </div>
            </div>

            {currentDelivery.notes && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">{currentDelivery.notes}</p>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={handleStartNavigation}
              className="py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
            >
              <Navigation className="h-5 w-5" />
              <span>Navigate</span>
            </button>
            <button
              onClick={handleCompleteDelivery}
              disabled={currentDelivery.status === 'completed'}
              className={`py-3 rounded-lg transition flex items-center justify-center space-x-2 ${
                currentDelivery.status === 'completed' 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <CheckCircle className="h-5 w-5" />
              <span>Complete</span>
            </button>
          </div>
        </div>
      )}

      {/* Vehicle Status */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Status</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Battery className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Fuel Level</p>
                <p className="font-medium text-gray-900">{vehicleStatus.fuelLevel}%</p>
              </div>
            </div>
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${vehicleStatus.fuelLevel < 20 ? 'bg-red-500' : 'bg-green-500'} rounded-full`}
                style={{ width: `${vehicleStatus.fuelLevel}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Truck className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Mileage</p>
                <p className="font-medium text-gray-900">{vehicleStatus.mileage.toLocaleString()} km</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Next service in {vehicleStatus.nextService} km
            </div>
          </div>

          {vehicleStatus.issues.length > 0 && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-900">Vehicle Issues</p>
                  <ul className="mt-1 space-y-1">
                    {vehicleStatus.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-orange-700">• {issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleReportIssue}
          className="w-full mt-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
        >
          Report Issue
        </button>
      </div>

      {/* Daily Vehicle Inspection */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Inspection</h2>
        
        <div className="space-y-3">
          {inspectionItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{item.item}</p>
                {item.notes && (
                  <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                )}
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                item.status === 'ok' ? 'bg-green-100 text-green-800' :
                item.status === 'needs-attention' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {item.status === 'ok' ? 'OK' : item.status === 'needs-attention' ? 'Needs Attention' : 'Critical'}
              </span>
            </div>
          ))}
        </div>

        <button className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
          Submit Inspection
        </button>
      </div>

      {/* Emergency & Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSOS}
            className={`py-3 rounded-lg font-medium flex flex-col items-center justify-center ${
              sosActive 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-red-100 hover:bg-red-200 text-red-800'
            }`}
          >
            <Shield className="h-6 w-6 mb-1" />
            <span>{sosActive ? 'SOS ACTIVE' : 'Emergency SOS'}</span>
          </button>

          <button className="py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex flex-col items-center justify-center">
            <Phone className="h-6 w-6 text-gray-600 mb-1" />
            <span className="text-gray-900">Call Dispatch</span>
          </button>

          <button className="py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex flex-col items-center justify-center">
            <MessageSquare className="h-6 w-6 text-gray-600 mb-1" />
            <span className="text-gray-900">Message</span>
          </button>

          <button className="py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex flex-col items-center justify-center">
            <FileText className="h-6 w-6 text-gray-600 mb-1" />
            <span className="text-gray-900">SOP Library</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation - Mobile Style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-2 flex justify-around">
        <button className="flex flex-col items-center p-2">
          <Home className="h-5 w-5 text-blue-600" />
          <span className="text-xs mt-1 text-blue-600">Home</span>
        </button>
        <button className="flex flex-col items-center p-2">
          <Navigation className="h-5 w-5 text-gray-400" />
          <span className="text-xs mt-1 text-gray-500">Navigation</span>
        </button>
        <button className="flex flex-col items-center p-2">
          <FileText className="h-5 w-5 text-gray-400" />
          <span className="text-xs mt-1 text-gray-500">Documents</span>
        </button>
        <button className="flex flex-col items-center p-2">
          <Wrench className="h-5 w-5 text-gray-400" />
          <span className="text-xs mt-1 text-gray-500">Vehicle</span>
        </button>
      </nav>

      <div className="mb-16"></div> {/* Spacer for bottom nav */}
    </div>
  );
};

export default DriverDashboard;