import hashlib
import platform
import subprocess
import uuid

def generate_machine_fingerprint():
    """
    Creates a unique hardware ID that ties the license to one computer.
    Combines multiple hardware identifiers so it survives partial changes.
    """
    components = []
    
    # Windows Hardware UUID (most stable identifier)
    try:
        result = subprocess.check_output(
            'wmic csproduct get uuid',
            shell=True, stderr=subprocess.DEVNULL
        ).decode().strip().split('\n')
        hw_uuid = result[1].strip() if len(result) > 1 else ''
        if hw_uuid and hw_uuid != 'UUID':
            components.append(hw_uuid)
    except:
        pass
    
    # CPU ID
    try:
        result = subprocess.check_output(
            'wmic cpu get processorid',
            shell=True, stderr=subprocess.DEVNULL
        ).decode().strip().split('\n')
        cpu_id = result[1].strip() if len(result) > 1 else ''
        if cpu_id:
            components.append(cpu_id)
    except:
        pass
    
    # Motherboard serial
    try:
        result = subprocess.check_output(
            'wmic baseboard get serialnumber',
            shell=True, stderr=subprocess.DEVNULL
        ).decode().strip().split('\n')
        mb_serial = result[1].strip() if len(result) > 1 else ''
        if mb_serial and mb_serial.lower() not in ['to be filled by o.e.m.', 'none', '']:
            components.append(mb_serial)
    except:
        pass
    
    # Fallback: MAC address
    if not components:
        try:
            mac = ':'.join([
                '{:02x}'.format((uuid.getnode() >> elements) & 0xff)
                for elements in range(0, 2*6, 2)][::-1]
            )
            components.append(mac)
        except:
            pass
            
    # Hash everything together
    raw = '|'.join(components) + '|ZAIRE_SOVEREIGN'
    return hashlib.sha256(raw.encode()).hexdigest()[:32]

if __name__ == '__main__':
    print("Machine Fingerprint:", generate_machine_fingerprint())
