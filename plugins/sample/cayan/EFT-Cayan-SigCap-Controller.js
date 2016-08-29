window.angular.module('prismPluginsSample.controller.cayanSigCapController', [])
  .controller('cayanSigCapController', ['$scope', '$location', '$stateParams', 'eftCayanService', '$modal', 'NotificationService', 'Templates', 'prismSessionInfo', 'PrismUtilities', 'DocumentPersistedData', '$http', 'ModelService','ShopperDisplay','ButtonHooksEventDispatcher',
    function($scope, $location, $stateParams, eftCayanService, $modal, NotificationService, Templates, prismSessionInfo, PrismUtilities, DocumentPersistedData, $http, ModelService, ShopperDisplay, ButtonHooksEventDispatcher){
      'use strict';

      $scope.showSigCap = false; // setting default value for showSigCap
      $scope.user = {signature:''}; // setting default values for $scope.user and user.signature
      $scope.tender = {}; // setting default value for $scope.tender
      $scope.eftmwData = {}; // setting devault value
      var documentParams = {sid:$stateParams.document_sid,cols:'*'}; // Parameters to pass when requesting document
      ModelService.get('Document',documentParams).then(function(data){ // get document information from the server
        $scope.document = data[0]; // assign the document information to the $scope.document variable (needed for adding tenders)
      });

      $scope.cancelTransactionFromSignature = function(){  // create function to cancel the transaction
        $scope.cancelTransactionModalPromise = $modal.open({ // define promise for cancelling the transaction and open a modal
          backdrop:'static', // define modal backdrop
          keyboard:false, // define modal keyboard
          dialogClass : 'modal newCustomerModal', // define modal classes
          templateUrl:  '/plugins/sample/cayan/EFT-Cayan-Cancel.htm', // define modal template
          controller: 'cayanCancelController' // define modal controller
        });
        $scope.cancelTransactionModalPromise.result.then(function(decision){ // define the result on the modal promise
          if(decision === 'cancel'){  // check if user confirmed to cancel transaction
            eftCayanService.Credit.Initiate({ // initiate eft call to void the CC transaction
              document_sid:$stateParams.document_sid, // assign document_sid
              actiontype:'VOID_TRANSACTION', // set the actiontype
              usegeniusdevice:false, // define whether to use the genius device
              forcedupcheck:false, // define forcedupcheck
              token:$scope.eftmwData.token // assign token value
            }).then(function(voidResult){  // run funtion with response from server
              if(voidResult[0].approvalstatus.toLowerCase() !== 'approved'){ // check if the void was approved by server
                NotificationService.addAlert(voidResult[0].errormessage, voidResult[0].approvalstatus); // add alert with response if void was not approved
              } else {
                // redirect the page if the void was approved back to the tender screen
                $location.path('/register/pos/' + $stateParams.screen + '/' + $stateParams.document_sid + '/' + $stateParams.mode + '/tender');
              }
            });
          }
        });
      };

      // define function to accept and store the signature capture
      $scope.acceptSignature = function(){
        var acceptedSigData = { // define the signature capture data
          'sigcapdata':JSON.stringify($scope.user.signature), // convert the drawn path to a string
          'row_version':$scope.eftmwData.row_version, // define row version
          sid:$stateParams.eftmwSid // define the SID
        };
        var updateMWT = eftCayanService.Credit.Update(acceptedSigData); // update the credit card transaction with the signature data
        updateMWT.then(function(){
          return $scope.document.addTender($scope.tender); // add the tender to the document
        })
          .then(function(){
            // redirect the page to the tender screen
            $location.path('/register/pos/' + $stateParams.screen + '/' + $stateParams.document_sid + '/' + $stateParams.mode + '/tender');
          });
      };

      $http.defaults.headers.common['Auth-Session'] = $stateParams.auth; // assign http headers
      sessionStorage.setItem('PRISMAUTH', $stateParams.auth); // add items to session storage

      //set up the status check
      eftCayanService.Credit.Status({
        sid:$stateParams.eftmwSid,
        cols:'approvalstatus,errormessage,authcode,tendertype,token,row_version,amount,card_type_desc,card_type,cardnumber'
      }).then(function(returnObject){ // function to run with response from server on status
        var returnValues = returnObject[0];  // assign returned data to returnValues
        if(returnValues.approvalstatus.toLowerCase() === 'approved'){ // check if the status was approved
          $scope.eftmwData = returnValues;
          //show the signature capture
          $scope.showSigCap = PrismUtilities.toBoolean(prismSessionInfo.get().preferences.eft_mw_requires_sig_cap);
          // check if sigcap is true and if preference is set
          if($scope.showSigCap && parseFloat(prismSessionInfo.get().preferences.eft_mw_sig_cap_floor_limit) > 0){
            // set showSigCap based on if amount is greater than floor limit
            $scope.showSigCap = parseFloat(returnValues.amount) > parseFloat(prismSessionInfo.get().preferences.eft_mw_sig_cap_floor_limit);
          }
          $scope.tender = ModelService.create('Tender'); // Create a new Tender object
          $scope.tender.tender_type = returnValues.tendertype; // assign tendertype from EFT
          $scope.tender.document_sid = $stateParams.document_sid; // assign document_sid from URL
          if($stateParams.tendermode === 'Take'){ // check if tendermode based on URL
            $scope.tender.taken = returnValues.amount; // set taken amount
          } else {
            $scope.tender.given = returnValues.amount; // set given amount
          }
          $scope.tender.authorization_code = returnValues.authcode; // set authorization_code from EFT
          $scope.tender.card_number = returnValues.cardnumber.substr(returnValues.cardnumber.length - 10); // set card number from EFT, truncating length to fit DB field
          if(returnValues.card_type_desc.length > 0){ // check card type length
            $scope.tender.tender_name = returnValues.card_type_desc.substr(0, 25); // set tender name based on card type description
          } else {
            $scope.tender.tender_name = $scope.tender.printName(returnValues.tendertype).substr(0, 25); // set tender name based on tendertype
          }
          $scope.tender.eft_transaction_id = returnValues.token; // set eft_transaction_id to token returned from EFT
          $scope.tender.eftdata1 = returnValues.card_type; // set eftdata1 to card_type from EFT
          if(!$scope.showSigCap){ // verify that showSigCap is false
            $scope.document.addTender($scope.tender).then(function(){ // add tender to document and then redirect
              $location.path('/register/pos/' + $stateParams.screen + '/' + $scope.document.sid + '/' + $stateParams.mode + '/tender');
            });
          }
        } else {
          if(returnValues.errormessage.length > 0){
            // if error message has length set error message to approval status
            returnValues.errormessage = returnValues.approvalstatus;
          }
          if(returnValues.approvalstatus === 'DECLINED_DUPLICATE'){
            ShopperDisplay.Redraw(); // redraw shopper display
            //('The requested transaction was determined to be a duplicate of a previous transaction. Would you like to resend the transaction attempt without duplicate detection?', 'DECLINED, DUPLICATE'); // Untranslated values for the message
            NotificationService.addConfirm('2414', '2415').then(function(decision){
              DocumentPersistedData.DocumentInformation.DuplicateTransaction = decision;
            });
          } else {
            // display alert with error returned from EFT
            NotificationService.addAlert(returnValues.errormessage, returnValues.approvalstatus);
          }
          //redirect page back to tender screen
          $location.path('/register/pos/' + $stateParams.screen + '/' + $stateParams.document_sid + '/' + $stateParams.mode + '/tender');
        }
      });
    }]);
