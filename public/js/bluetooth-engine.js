// Bluetooth Engine - Handles Bluetooth device discovery and connection

class BluetoothEngine {
  constructor() {
    this.connectedDevice = null;
    this.devices = new Map();
    this.isScanning = false;
    this.characteristicUUID = null;
    this.bluetoothAvailable = 'bluetooth' in navigator;
  }

  // Check if Bluetooth is available
  isAvailable() {
    return this.bluetoothAvailable;
  }

  // Scan for Bluetooth devices
  async scanDevices(onDeviceFound) {
    if (!this.bluetoothAvailable) {
      console.error('Bluetooth not supported in this browser');
      return false;
    }

    this.isScanning = true;

    try {
      // Request any Bluetooth device (speakers, headphones, etc.)
      // acceptAllDevices allows scanning for all devices without service filtering
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'battery_service',
          'device_information',
          '0000110e-0000-1000-8000-00805f9b34fb', // Audio source service UUID
        ],
      });

      if (device) {
        this.devices.set(device.id, {
          id: device.id,
          name: device.name,
          connected: device.gatt.connected,
          rssi: null,
          timestamp: Date.now(),
        });

        if (onDeviceFound) {
          onDeviceFound({
            id: device.id,
            name: device.name,
            connected: device.gatt.connected,
          });
        }
      }

      this.isScanning = false;
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        console.log('No Bluetooth devices found');
      } else if (error.name !== 'NotAllowedError') {
        console.error('Bluetooth scan error:', error);
      }
      this.isScanning = false;
      return false;
    }
  }

  // Connect to a Bluetooth device
  async connectDevice(deviceId) {
    try {
      // Get device from the map
      if (!this.devices.has(deviceId)) {
        console.error('Device not found in devices map');
        return false;
      }

      const device = this.devices.get(deviceId);

      // Request the device by name filter - valid approach
      let bluetoothDevice;
      try {
        bluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [{ name: device.name }],
          optionalServices: ['battery_service', 'device_information'],
        });
      } catch (err) {
        // Fallback: if filter fails, allow user to select from all devices
        bluetoothDevice = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'device_information'],
        });
      }

      if (!bluetoothDevice) {
        return false;
      }

      // Connect to GATT server
      const gattServer = await bluetoothDevice.gatt.connect();
      console.log('Connected to GATT server');

      // Store connected device
      this.connectedDevice = {
        id: bluetoothDevice.id,
        name: bluetoothDevice.name,
        gatt: gattServer,
        device: bluetoothDevice,
        connectedAt: Date.now(),
      };

      // Update device status
      if (this.devices.has(deviceId)) {
        const deviceData = this.devices.get(deviceId);
        deviceData.connected = true;
      }

      // Listen for disconnection
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        console.log('Bluetooth device disconnected');
        this.connectedDevice = null;
        if (this.devices.has(deviceId)) {
          const deviceData = this.devices.get(deviceId);
          deviceData.connected = false;
        }
      });

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }

  // Disconnect from Bluetooth device
  async disconnectDevice() {
    if (this.connectedDevice && this.connectedDevice.device) {
      this.connectedDevice.device.gatt.disconnect();
      this.connectedDevice = null;
      console.log('Bluetooth device disconnected');
      return true;
    }
    return false;
  }

  // Check if connected to a device
  isConnected() {
    return this.connectedDevice !== null && this.connectedDevice.device.gatt.connected;
  }

  // Get connected device info
  getConnectedDevice() {
    if (this.isConnected()) {
      return {
        id: this.connectedDevice.id,
        name: this.connectedDevice.name,
        connectedAt: this.connectedDevice.connectedAt,
      };
    }
    return null;
  }

  // Get all discovered devices
  getDevices() {
    return Array.from(this.devices.values());
  }

  // Clear device list
  clearDevices() {
    this.devices.clear();
  }

  // Get device by ID
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }
}
