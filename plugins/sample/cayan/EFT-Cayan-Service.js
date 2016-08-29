/**
 * @ngdoc service
 * @name prismPluginsSample.service.eftCayanService
 * @description
 * Service that handles EFT operations for Cayan.
 */
window.angular.module('prismPluginsSample.service.eftCayanService', [])
  .factory('eftCayanService', ['$resource', '$q', 'PrismUtilities', 'prismSessionInfo',
    function($resource, $q, PrismUtilities, prismSessionInfo) {
      'use strict';

      var eftmwAPI = '/v1/rest/eftmw/:sid',  // set location of eftmwAPI
        mwResource = $resource(eftmwAPI, {}, PrismUtilities.resourceMethods), // define mwResource
        mwCEDAPI = '/v1/rest/ced/:sid', // set location of the mwCEDAPI
        CEDResource = $resource(mwCEDAPI, {}, PrismUtilities.resourceMethods), // define CEDResource
        sessionInfo = prismSessionInfo.get(); // define session variables



      //main credit functions
      /**
       * @ngdoc method
       * @name (Credit) Initiate
       * @methodOf prismPluginsSample.service.eftCayanService
       * @description
       *
       * Initiates a credit transaction. Generates an HTTP request to the EFT endpoint       *
       * Called as: eftCayanService.Credit.Initiate
       *
       * ## MerchantWare
       * MerchantWare Required Parameters: document_sid, actiontype, usegeniusdevice, forcedupcheck
       * MerchantWare Optional Parameters: token, rawtrackdata, cardnumber, web_redirect, amount
       *
       * @param {Object} params parameters passed to the function as required by the configured provider.
       *
       * @returns {Promise} Promise object representing the result of the HTTP operation
       *
       **/
      function initiateCreditTransaction(params){
        var CreditInitiateResource,
          defObj = $q.defer(),
          initData = [{origin_application:sessionInfo.application}];

        // check that the document_sid, action type and usegeniusdevice are defined
        if(params.document_sid !== undefined && params.actiontype !== undefined && params.usegeniusdevice !== undefined && params.forcedupcheck !== undefined){
           initData[0] = angular.extend(initData[0], params); // assign params to initData
           initData[0].register_id = generateRegisterID(); // add register_id to initData
           mwResource = $resource(eftmwAPI, {}, PrismUtilities.resourceMethods); // initialize mwResource using eftmwAPI
           CreditInitiateResource = mwResource.create(initData); // create new mwResource using initDat
        } else {
           throw new Error('Invalid or Missing Properties - document_sid, actiontype, usegeniusdevice, and forcedupcheck are required for MerchantWare transactions');
        }


        CreditInitiateResource.$promise.then(function(data){ // define promise
          defObj.resolve(PrismUtilities.responseParser(data)); // parse returned data then resolve promise
        }, function(data){
          defObj.reject(data); // if error reject promise with error data
        });

        return defObj.promise; // return promise
      }

      /**
       * @ngdoc method
       * @name (Credit) Status
       * @methodOf prismPluginsSample.service.eftCayanService
       * @description
       *
       * Gets the requested properties of the specified EFT transaction. Generates an HTTP request to the EFT
       * endpoint that is specific to the configured provider. See the provider notes below for details on this
       * type of request.
       *
       * Called as: eftCayanService.Credit.Status
       *
       * ## MerchantWare
       * MerchantWare Required Parameters: sid
       * MerchantWare Optional Parameters: cols, filter
       *
       * @param {Object} params parameters passed to the function as required by the configured provider.
       *
       * @returns {Promise} Promise object representing the result of the HTTP operation
       *
       **/
      function getCreditTransactionStatus(params){
        var CreditStatusResource,
          defObj = $q.defer();

        if(params.sid !== undefined){ // check if the sid has been defined
          mwResource = $resource(eftmwAPI, {sid:params.sid}, PrismUtilities.resourceMethods); // initialize mwResource using eftmwAPI
          CreditStatusResource = mwResource.query(params); // query the mwResource and assign response as CreditStatusResource
        } else {
          throw new Error('Invalid or Missing Properties - sid is required for MerchantWare transactions.');
        }

        CreditStatusResource.$promise.then(function(data){
          defObj.resolve(PrismUtilities.responseParser(data)); // parse returned data then resolve promise
        }, function(data){
          defObj.reject(data); // if error reject promise with error data
        });

        return defObj.promise; // return promise
      }

      /**
       * @ngdoc method
       * @name (Credit) Update
       * @methodOf prismPluginsSample.service.eftCayanService
       * @description
       *
       * Updates the specified EFT transaction properties to the passed values. Generates an HTTP request to the
       * EFT endpoint that is specific to the configured provider. See the provider notes below for details on
       * this type of request.
       *
       * Called as: eftCayanService.Credit.Update
       *
       * ## MerchantWare
       * MerchantWare Required Parameters: sid, row_version
       * MerchantWare Optional Parameters: sigcapdata, web_redirect
       *
       * @param {Object} params parameters passed to the function as required by the configured provider.
       * @returns {Promise} Promise object representing the result of the HTTP operation
       *
       **/
      function updateCreditTransaction(params){
        var CreditUpdateResource,
          defObj = $q.defer();

        // check if the sid and row_version have been defined
        if(params.sid !== undefined && params.row_version !== undefined){
          mwResource = $resource(eftmwAPI, {sid:params.sid, filter:'row_version,eq,' + params.row_version}, PrismUtilities.resourceMethods);// initialize mwResource using eftmwAPI
          CreditUpdateResource = mwResource.update([params]); // query the mwResource and assign response as CreditUpdateResource
        } else {
          throw new Error('Invalid or Missing Properties - sid and row_version are required for MerchantWare transactions.');
        }

        CreditUpdateResource.$promise.then(function(data){
          defObj.resolve(PrismUtilities.responseParser(data)); // parse returned data then resolve promise
        }, function(data){
          defObj.reject(data); // if error reject promise with error data
        });

        return defObj.promise; // return promise
      }

      /**
       * @ngdoc method
       * @name (Credit) RemoteDevice
       * @methodOf prismPluginsSample.service.eftCayanService
       * @description
       *
       * Initiates a credit transaction for the configured provider using the specified device. Generates an
       * HTTP request to the EFT endpoint that is specific to the configured provider. See the provider notes
       * below for details on this type of request.
       *
       * Called as: eftCayanService.Credit.RemoteDevice
       *
       * ## MerchantWare
       * MerchantWare Required Parameters: sid, transportkey, document_sid
       *
       * @param {Object} params parameters passed to the function as required by the configured provider.
       * @returns {Promise} Promise object representing the result of the HTTP operation
       *
       **/
      function deviceCreditTransaction(params){
        var defObj = $q.defer(),
          CreditDeviceResource;

        // verify that transportkey, sid and document_sid have been defined
        if(params.transportkey !== undefined && params.sid !== undefined && params.document_sid !== undefined){
          CEDResource = $resource(mwCEDAPI, {sid:params.sid}, PrismUtilities.resourceMethods); // initialize CEDResource using mwCEDAPI
          CreditDeviceResource = CEDResource.create([{transportkey:params.transportkey, sid:params.document_sid}]);  // create a new CEDResource and assign response as CreditDeviceResource
        } else {
          throw new Error('Invalid or Missing Properties - sid, transportkey, and document_sid are required for MerchantWare transactions.');
        }

        CreditDeviceResource.$promise.then(function(){
          defObj.resolve(); // resolve the promise
        }, function(data){
          defObj.reject(data); // reject the promise
        });

        return defObj.promise; // return the promise
      }

      //main gift functions
      /**
       * @ngdoc method
       * @name (Gift) Initiate
       * @methodOf prismPluginsSample.service.eftCayanService
       * @description
       *
       * Initiates a gift transaction for the configured provider. Generates an HTTP request to the EFT
       * endpoint that is specific to the configured provider. See the provider notes below for details
       * on this type of request.
       *
       * Called as: eftCayanService.Gift.Initiate
       *
       * ## MerchantWare
       * MerchantWare Required Parameters: document_sid, actiontype, usegeniusdevice, forcedupoverride, amount,
       * and either rawtrackdata or cardnumber
       * MerchantWare Optional Parameters: token
       *
       * @returns {Promise} Promise object representing the result of the HTTP operation
       *
       **/
      function initiateGiftTransaction(params){
        var GiftResource,
          defObg = $q.defer(),
          initData = params;

        // verify that document_sid, actiontype, usegeniusdevice, forcedupcheck, rawtrackdata,and cardnumber  have been defined
        if(params.document_sid !== undefined && params.actiontype !== undefined && params.usegeniusdevice !== undefined && params.forcedupcheck !== undefined && (params.rawtrackdata !== undefined || params.cardnumber !== undefined)){
          initData = angular.extend(initData, {origin_application:sessionInfo.application}); // assign params to initData
          initData.register_id = generateRegisterID(); // add register_id to initData
          mwResource = $resource(eftmwAPI, {}, PrismUtilities.resourceMethods); // initialize mwResource using eftmwAPI
          GiftResource = mwResource.create([initData]); // create new mwResource using initData
        } else {
          throw new Error('Invalid or Missing Properties - document_sid, actiontype, usegeniusdevice, forcedupcheck, and either rawtrackdata or cardnumber are required for MerchantWare transactions.');
        }

        GiftResource.$promise.then(function(data){
          defObg.resolve(PrismUtilities.responseParser(data)); // parse the response and then resolve the promise
        }, function(data){
          defObg.reject(data); // reject the promise
        });

        return defObg.promise; // return the promise
      }

      /**
       * @ngdoc method
       * @name eftCayanService#ListDevices
       * @methodOf prismPluginsSample.service.eftCayanService
       * @description
       *
       * Gets a list of the external devices that are configured for the current workstation. Generates an
       * HTTP request to the EFT endpoint that is specific to the configured provider. See provider notes
       * for details on this type of request.
       *
       * @returns {Promise} Promise object representing the result of the HTTP operation
       *
       **/
      function deviceList(){
        var defObj = $q.defer();
        var DeviceResource;

        CEDResource = $resource(mwCEDAPI, {}, PrismUtilities.resourceMethods); // initialize the CEDResource using the mwCEDAPI
        DeviceResource = CEDResource.query(); // query the CEDResource assign response as DeviceResource

        DeviceResource.$promise.then(function(data){
          defObj.resolve(PrismUtilities.responseParser(data)); // parse the response and then resolve the promise
        }, function(data){
          defObj.reject(data); // reject the promise
        });

        return defObj.promise; // return the promise

      }

      /**
       * @ngdoc method
       * @name eftCayanService#CancelRemoteDevice
       * @methodOf prismPluginsSample.service.eftCayanService
       * @param {String} deviceID ID of the device to use in the request.
       * @description
       *
       * Issues a command to the specified device to cancel the current transaction. Generates an
       * HTTP request to the EFT endpoint that is specific to the configured provider. See provider notes
       * for details on this type of request.
       *
       * @returns {Promise} Promise object representing the result of the HTTP operation
       *
       **/
      function cancelRemoteDevice(deviceID, deviceTransactionSid){
        if(!deviceID){
          throw new Error('EFT Service - Cancel Remote Device - deviceID must not be empty!');
        }

        var defObj = $q.defer(),
          CreditDeviceResource;

        CEDResource = $resource(mwCEDAPI + '/cancel', {sid:deviceID}, PrismUtilities.resourceMethods);// initialize the CEDResource using the mwCEDAPI
        CreditDeviceResource = CEDResource.update({eftmwsid:deviceTransactionSid}); // update the CEDResource with a new deviceTransactionSid

        CreditDeviceResource.$promise.then(function(){
          defObj.resolve(); // resolve the promise
        }, function(data){
          defObj.reject(data); // reject the promise
        });

        return defObj.promise; // return the promise
      }

      // function generate register IDs
      function generateRegisterID(){
        var storeNumber = sessionInfo.storenumber.toString(), // set store number from session to local variable
          workstationNumber = sessionInfo.workstationid.toString(); // set workstation ID from session to local variable
        if(storeNumber.length > 4){ // check if storenumber is too long
          storeNumber = storeNumber.substr(storeNumber.length - 4); // return only the first 4 characters of the store number
        } else if(storeNumber < 4){ // check if storenumber is too short
          while(storeNumber.length < 4){
            storeNumber = '0' + storeNumber; // fill in store number with leading zeros
          }
        }
        if(workstationNumber.length > 4){ // check if workstationnumber is too long
          workstationNumber = workstationNumber.substr(workstationNumber.length - 4); // return only the first 4 characters of workstation number
        } else if(workstationNumber < 4){ // check if workstation number is too short
          while(workstationNumber.length < 4){
            workstationNumber = '0' + workstationNumber; // fill in workstation number with leading zeros
          }
        }

        return storeNumber + workstationNumber; // return string that combines store number and workstation number
      }

      // function to allow keyed entry of CC data on CED device
      function custKeyedEntry(deviceID, deviceTransactionSid) {
        if(!deviceID){
          throw new Error('EFT Service - Customer Keyed Entry - deviceID must not be empty!');
        }
        var defObj = $q.defer(),
        CreditDeviceResource;
        // initialize CED resource data
        CEDResource = $resource(mwCEDAPI + '/keyedsale', {sid:deviceID}, PrismUtilities.resourceMethods);
        CreditDeviceResource = CEDResource.update({eftmwsid:deviceTransactionSid});


        CreditDeviceResource.$promise.then(function(){
          defObj.resolve();
        }, function(data){
          defObj.reject(data);
        });

        return defObj.promise;
}

      return {
        Credit:{
          Initiate:initiateCreditTransaction,
          Status:getCreditTransactionStatus,
          Update:updateCreditTransaction,
          RemoteDevice:deviceCreditTransaction
        },
        Gift:{
          Initiate:initiateGiftTransaction
        },
        ListDevices:deviceList,
        CancelRemoteDevice:cancelRemoteDevice,
        keyedEntry:custKeyedEntry
      };
    }
  ]);
