// 解析综合数据消息
// 格式: "imu0,sec,nsec,ox,oy,oz,avx,avy,avz,lax,lay,laz;imu1,sec,nsec,ox,oy,oz,avx,avy,avz,lax,lay,laz;gnss,lat,lng,alt"
function parseCombinedMessage(message) {
    try {
        const parts = message.split(';');
        const result = {};
        
        parts.forEach(part => {
            const data = part.split(',');
            const type = data[0];
            
            switch(type) {
                case 'imu0':
                case 'imu1':
                    if (data.length >= 12) {
                        result[type] = {
                            type: type,
                            timestamp: {
                                sec: parseFloat(data[1]),
                                nsec: parseFloat(data[2])
                            },
                            orientation: {
                                x: parseFloat(data[3]),
                                y: parseFloat(data[4]),
                                z: parseFloat(data[5])
                            },
                            angular_velocity: {
                                x: parseFloat(data[6]),
                                y: parseFloat(data[7]),
                                z: parseFloat(data[8])
                            },
                            linear_acceleration: {
                                x: parseFloat(data[9]),
                                y: parseFloat(data[10]),
                                z: parseFloat(data[11])
                            }
                        };
                    }
                    break;
                case 'gnss':
                    if (data.length >= 4) {
                        result.gnss = {
                            type: 'gnss',
                            latitude: parseFloat(data[1]),
                            longitude: parseFloat(data[2]),
                            altitude: parseFloat(data[3])
                        };
                    }
                    break;
            }
        });
        
        return result;
    } catch (e) {
        console.error('解析消息时出错:', e);
        return null;
    }
}

// 应用平滑处理
function applyMovingAverage(data, windowSize = 5) {
    if (data.length < windowSize) return data;
    
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        
        // 计算窗口范围
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(data.length - 1, i + Math.floor(windowSize / 2));
        
        for (let j = start; j <= end; j++) {
            sum += data[j];
            count++;
        }
        
        smoothed.push(sum / count);
    }
    
    return smoothed;
}

// 处理一批消息
function processBatch(messages, maxPoints) {
    // 创建新数据结构
    const result = {
        imu0: { av: {x: [], y: [], z: []}, la: {x: [], y: [], z: []} },
        imu1: { av: {x: [], y: [], z: []}, la: {x: [], y: [], z: []} },
        gnss: []
    };
    
    // 处理每条消息
    messages.forEach(message => {
        const parsed = parseCombinedMessage(message);
        if (!parsed) return;
        
        // 收集IMU0数据
        if (parsed.imu0) {
            result.imu0.av.x.push(parsed.imu0.angular_velocity.x);
            result.imu0.av.y.push(parsed.imu0.angular_velocity.y);
            result.imu0.av.z.push(parsed.imu0.angular_velocity.z);
            
            result.imu0.la.x.push(parsed.imu0.linear_acceleration.x);
            result.imu0.la.y.push(parsed.imu0.linear_acceleration.y);
            result.imu0.la.z.push(parsed.imu0.linear_acceleration.z);
        }
        
        // 收集IMU1数据
        if (parsed.imu1) {
            result.imu1.av.x.push(parsed.imu1.angular_velocity.x);
            result.imu1.av.y.push(parsed.imu1.angular_velocity.y);
            result.imu1.av.z.push(parsed.imu1.angular_velocity.z);
            
            result.imu1.la.x.push(parsed.imu1.linear_acceleration.x);
            result.imu1.la.y.push(parsed.imu1.linear_acceleration.y);
            result.imu1.la.z.push(parsed.imu1.linear_acceleration.z);
        }
        
        // 收集GNSS数据
        if (parsed.gnss) {
            result.gnss.push({
                latitude: parsed.gnss.latitude,
                longitude: parsed.gnss.longitude,
                altitude: parsed.gnss.altitude
            });
        }
    });
    
    // 向主线程返回处理后的数据
    self.postMessage({
        type: 'processedData',
        data: result
    });
}

// 监听来自主线程的消息
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch(type) {
        case 'processBatch':
            processBatch(data.messages, data.maxPoints);
            break;
        default:
            console.log('Worker收到未知类型消息:', type);
    }
};
