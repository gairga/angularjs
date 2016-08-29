window.angular.module('prismPluginsSample.controller.cayanDeviceController',[])
  .controller('cayanDeviceController', ['$scope', '$modalInstance', '$modal', 'MWData', '$timeout', 'eftCayanService', '$q', 'PrismUtilities', 'NotificationService', 'ShopperDisplay','PrintersService','prismSessionInfo','DocumentPersistedData','ModelService','Templates',
    function($scope, $modalInstance, $modal, MWData, $timeout, eftCayanService, $q, PrismUtilities, NotificationService, ShopperDisplay, PrintersService, prismSessionInfo, DocumentPersistedData, ModelService, Templates){
      'use strict';

      $scope.timeoutID = 0; // Declaring variable to hold timout values
      $scope.deviceList = {}; // Declaring variable to hold the device list
      $scope.bypassDeviceDisabled = MWData.debit; // set whether its a debit transaction
      $scope.deviceInitialized = false; // setting variable for device initialization
      $scope.bypass = false; // setting variable for device bypass
      $scope.cedApproved = false; // setting variable for ced approval
      $scope.actionType = MWData.actiontype; // add the Action type to scope for logic checks in the html
      $scope.printSid = 1;
      $scope.showKeyedEntry = ($scope.actionType === 'CREDIT_TAKE') || ($scope.actionType === 'CREDIT_GIVE') || ($scope.actionType === 'CREDIT_FORCE');
      console.log($scope.actionType);
      console.log($scope.showKeyedEntry);

      // function to allow keyed entry on the CED
      $scope.keyedEntry = function() {
        if($scope.deviceList[0] === undefined || $scope.deviceList[0].sid === undefined){ // verify that CED is present
          //Need to be able to send them to the bypass screen like poscancelled
          $modalInstance.dismiss();
        } else {
          eftCayanService.keyedEntry($scope.deviceList[0].sid, MWData.sid);
        }
      };

      // function to abort the CED connection
      $scope.abortCED = function (bypass) {
        $scope.bypass = bypass;
        if($scope.deviceList[0] === undefined || $scope.deviceList[0].sid === undefined){ // check if the device list has a value
          $modalInstance.dismiss(); // close modal
        } else {
          // call to cancel remote device function in the EFT Service defined in EFT-Cayan-Service.js
          eftCayanService.CancelRemoteDevice($scope.deviceList[0].sid, MWData.sid)
            .then(function(){
              $timeout.cancel($scope.timeoutID); // assign value to timeout cancel
              $scope.timeoutID = $timeout(function(){
                $scope.checkStatus(); // run function after one second delay
              }, 1000);
            });
        }
      };

      // checks the status of the EFT provider
      $scope.checkStatus = function(){
        // call to status function in the EFT Service defined in EFT-Cayan-Service.js
        eftCayanService.Credit.Status({
          sid:MWData.sid,
          cols:'approvalstatus,errormessage,authcode,paymenttype,token,row_version,amount,card_type_desc,card_type,tendertype,cardnumber,' +
              'EMV_AI_Aid,EMV_AI_AppLabel,EMV_CI_CardExpiryDate,EMV_CRYPTO_CryptogramType,EMV_CRYPTO_Cryptogram,EMV_PINStatement'
        }).then(function(data){
          $scope.status = data[0].approvalstatus.toLowerCase();
          // check if the prism is still waiting on response from CED
          if($scope.status !== 'prism_awaiting_ced'){
            // run function based on status response from CED
            switch($scope.status){
              case 'approved':
                // if approved close the modal and notify that ok to add tender, return data from CED
                $modalInstance.close({addtender:true, mwdata:data[0]});
                break;
              case 'cancelled':
              case 'poscancelled':
                // if cancelled, send redraw command to shopper display plugin
                ShopperDisplay.Redraw();
                $timeout.cancel($scope.timeoutID); // set time out id to cancel function
                // close the modal advising not to add the tender
                $modalInstance.close({addtender:false, runWithoutDevice:$scope.bypass, mwdata:{errormessage:'POSCANCELLED', approvalstatus:'Cancelled'}});
                break;
              case 'ced_already_approved':
                if(!$scope.cedApproved){ // make sure the already approved message hasnt been seen before
                  // Untranslated text 'The transaction is already Approved. You may not Bypass or Cancel at this time.', 'Transaction Already Approved'
                  NotificationService.addAlert('2910','2911');
                  $scope.deviceInitialized = false;
                  $scope.cedApproved = true; // set value that alert has been seen once.
                }
                $timeout.cancel($scope.timeoutID); // set timeout id to cancel function
                $scope.timeoutID = $timeout(function(){
                  $scope.checkStatus(); // check status after one second
                }, 500);
                break;

              default:
                // close the modal without adding a new tender
                $modalInstance.close({addtender:false, mwdata:data[0], runWithoutDevice:$scope.bypass});
                break;
            }
          } else {
            // if were still waiting for the CED to respond, then check again every half second
            $scope.timeoutID = $timeout(function(){
              $scope.checkStatus();
            }, 500);
          }
        });
      };

      // call the list devices function in the EFT Service defined in EFT-Cayan-Service.js
      eftCayanService.ListDevices()
        .then(function(data){
          var defObj = $q.defer();
          // pass data through the prism response parser
          $scope.deviceList = PrismUtilities.responseParser(data);

          if($scope.deviceList[0] === undefined || $scope.deviceList[0].sid === undefined){
            defObj.reject(); // cancel promise and exit function
          } else {
            defObj.resolve(); // resolve promise and continue processing
          }

          return defObj.promise;
        }).then(function(){
          // call the remote device function for credit cards in the EFT Service defined in EFT-Cayan-Service.js
          return eftCayanService.Credit.RemoteDevice({
            sid:$scope.deviceList[0].sid,
            transportkey:MWData.transportkey,
            document_sid:MWData.sid
          });

        }, function(){
          var defObj = $q.defer();
          // Show alert when there is no CED found
          // Untranslated text 'No Genius device was found.<br />Do you wish to proceed with the web transport instead?', 'No Device'
          NotificationService.addConfirm('4036','2798')
            .then(function(response){
              if(response){
                $modalInstance.close({addtender:false, mwdata:{}, runWithoutDevice:true})
              } else {
                $scope.abortCED();
              }
              defObj.reject();
          });



          return defObj.promise;
        }).then(function(){
          $scope.deviceInitialized = true;
          $scope.timeoutID = $timeout(function(){
            $scope.checkStatus();
          }, 7000);
        }, function(){
          $scope.deviceInitialized = true;
        });

    }
  ]);
