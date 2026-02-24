// ObjC wrapper required for React Native module registration
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FindMyStarCore, NSObject)

RCT_EXTERN_METHOD(raDecToAltAz:(double)ra dec:(double)dec lat:(double)lat lon:(double)lon unixMs:(double)unixMs resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(computePosition:(NSInteger)objectType objectId:(NSInteger)objectId jd:(double)jd resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(computeTracking:(NSInteger)objectType objectId:(NSInteger)objectId lat:(double)lat lon:(double)lon unixMs:(double)unixMs resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(computeTrackingRaDec:(double)ra dec:(double)dec lat:(double)lat lon:(double)lon unixMs:(double)unixMs resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(computeRiseSet:(NSInteger)objectType objectId:(NSInteger)objectId lat:(double)lat lon:(double)lon startMs:(double)startMs resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(computeRiseSetRaDec:(double)ra dec:(double)dec lat:(double)lat lon:(double)lon startMs:(double)startMs resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(altAzToVector3:(double)altitude azimuth:(double)azimuth resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(angularDistance:(double)x1 y1:(double)y1 z1:(double)z1 x2:(double)x2 y2:(double)y2 z2:(double)z2 resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(classifyTwilight:(double)sunAltitude resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(createEntitlement:(NSInteger)planType validUntilMs:(double)validUntilMs deviceId:(NSString *)deviceId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(checkEntitlement:(NSString *)payloadBase64 deviceId:(NSString *)deviceId nowMs:(double)nowMs resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(coreVersion:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
