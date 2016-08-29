window.angular.module('prismPluginsSample.controller.cayanGiftCardController',[])
  .controller('cayanGiftCardController', ['$scope', '$modalInstance', 'NotificationService', 'MWData', '$timeout', 'DocumentPersistedData', 'eftCayanService','$translate','ModelService','prismSessionInfo','PrintersService','$modal','Templates',
    function($scope, $modalInstance, NotificationService, MWData, $timeout, DocumentPersistedData, eftCayanService, $translate, ModelService, prismSessionInfo, PrintersService, $modal, Templates){
      'use strict';

      $scope.form = {  // Defines form data for future use
        cardData:null, // sets sub variable for cardData
        keyedCardData:null // sets sub variable for keyed entry card data
      };
      // get store data to be able to send to custom print job
      ModelService.get('Store', {sid:prismSessionInfo.get().storesid, cols:'address1,address2,address3,address4,address5,phone1,store_name,store_code,store_number,zip'}).then(function (data) {
        $scope.store = data[0];
        $scope.printData = // define data fields to send to custom print job
        {
          'store_number': data[0].store_number,
          'store_code': data[0].store_code,
          'store_name': data[0].store_name,
          'store_address1': data[0].address1,
          'store_address2': data[0].address2,
          'store_address3':data[0].address3,
          'store_address4':data[0].address4,
          'store_address5':data[0].address5,
          'store_zip':data[0].zip,
          'store_phone':data[0].phone1,
          'card_number':'', // leave card number blank will be filled later
          'card_balance':'' // leave card balance blank will be filled later
        };
      });

      $scope.saleAmount = MWData.tenderAmount; // variable for the tender amount
      $scope.balanceMode = MWData.giftMode === 'balance'; // if giftmode is balance then set balanceMode to true
      $scope.showResults = false; // defines value as false for future use
      $scope.showScanMode = true; // defines value as true for future use
      $scope.showKeyedMode = false; // defines value as false for future use
      $scope.processingTransaction = false; // defines value as false for future use
      $scope.focusSwipe = true; // defines value as true for future use
      $scope.showBalance = false; // defines value as false for future use
      $scope.showActivate = false; // defines value as false for future use
      // Untranslated text 'Please swipe card...'
      $scope.cardMessage = $translate.instant('3355');// Sets default value for cardMessage
      // Untranslated text 'Key in Card Number'
      $scope.entryMethod = $translate.instant('3356'); // Sets default value for entryMethod
      $scope.timer = 0;

      $scope.processingHappening = false; // defines value as false for future use
      $scope.approvalstatus = {}; // defines approvalstatus array for future use

      $scope.doFocus=function(){ // defines function to control focus on carddata
        $scope.focusSwipe=false; // after function is called set to false
        $timeout(function(){ // create 200 ms delay
          $scope.focusSwipe=true; // after delay set the focus value back to true
        },200);
      };

      // create angular watch on the form.cardData variable to watch for the value to change
      $scope.$watch('form.cardData', function (newValue, oldValue) {
        // compare the old value to the new value and if they are different
        if(newValue !== oldValue && newValue.length > 0 && $scope.showScanMode){
          // Untranslated text 'Reading Card...';
          $scope.cardMessage = $translate.instant('3357'); // Change message while card is being read
          $scope.processingHappening = true; // set value that EFT is in process
          $timeout.cancel($scope.timer); // cancel the time out
          $scope.timer = $timeout(function(){
            // Untranslated text 'Processing Transaction...';
            $scope.cardMessage = $translate.instant('3358');  // change message while transaction is processing
            $scope.modeSwitch(MWData.giftMode); // run function to trigger based on giftMode
          }, 250);
        }
      });

      // fuction to process keyedEntry
      $scope.keyedEntry = function(){
        // Untranslated text 'Processing Transaction...';
        $scope.cardMessage = $translate.instant('3358');  // update cardMessage
        $scope.processingHappening = true; // set value that EFT is in process
        $scope.modeSwitch(MWData.giftMode);// run function to trigger based on giftMode
      };

      // function to process based on giftMode
      $scope.modeSwitch = function(mode){
        switch (mode){ // switch on gift card method
          case 'balance': // if giftMode is balance run the getBalance function
            $scope.getBalance();
            break;
          case 'value': // if giftMode is value run the addValue function
            $scope.addValue();
            break;
          case 'activate': // if giftMode is activate run the activateCard function
            $scope.activateCard();
            break;
          default: // if giftMode is undefined run the tenderGiftCard function
            $scope.tenderGiftCard();
        }
      }

      // function to set card data with input data
      $scope.setCardData = function(data){
        $scope.$apply(function(){
          $scope.form.cardData = data;
        });
      };

      // close the modal while returning values
      $scope.closeForm = function () {
        $modalInstance.close({addtender:false, actiontype:'GIFT_BALANCE'});
      };

      $scope.changeEntryMethod = function(){
        $scope.showScanMode = !$scope.showScanMode;  // invert value of showScanMode
        $scope.showKeyedMode = !$scope.showKeyedMode; // invert value of showKeyedMode
        // Untranslated text 'Key in Card Number' : 'Scan Card';
        $scope.entryMethod = $scope.showScanMode ? $translate.instant('3356'):$translate.instant('3359');  // change text based on scanmode
        if($scope.showScanMode){
          $scope.focusSwipe = true;  // if showScanMode is true focus on swipe input
          // Untranslated text 'Please swipe card...'
          $scope.cardMessage = $translate.instant('3355');
        } else {
          $scope.cardMessage = ''; // clear cardMessage
        }
        $scope.form.cardData = ''; // clear cardData
      };

      // function to get the card balance from the EFT provider
      $scope.getBalance = function(){
        eftCayanService.Gift.Initiate({ // use EFT service to initiate gift transaction
          document_sid:DocumentPersistedData.DocumentInformation.Sid, // set document_sid based on persisted data
          actiontype:'GIFT_BALANCE', // set action type to send to EFT for GIFT_BALANCE
          amount:MWData.tenderAmount, // set amount based on sent data
          cardnumber:$scope.form.keyedCardData,  // set cardnumber based on keyedCardData
          rawtrackdata:$scope.form.cardData, //  set rawtrackdata based on cardData
          usegeniusdevice:false, // set usegeniusdevice to false (genius device cant swipe for balance)
          forcedupcheck:true // set forcedupcheck to true
        }).then(function(balData){  // after return from EFT process the following
          var balance = balData[0];  // set balance to the first element of the returned data
          if(balance.approvalstatus.toLowerCase() === 'approved'){  // if the balance transaction was approved by EFT
            $scope.cardBalance = balance.balance;  // set cardBalance to the returned balance value
            $scope.printData.card_number = balance.cardnumber;
            $scope.printData.card_balance = $scope.cardBalance; // set card balance for printing
            $scope.zeroBalance = parseFloat(balance.balance) === 0; // set to true if the balance was zero
            $scope.showScanMode = false; // reset the value for showScanMode to false;
            $scope.showKeyedMode = false; // reset the value for showKeyedMode to false
            $scope.showBalance = true; // set the showBalance value to true
          } else {
            NotificationService.addAlert(balance.errormessage, balance.approvalstatus); // create an alert with the failure message from the EFT
          }
        },function(data) {
          $scope.displayError(data); // run the display error function with data returned from the EFT
        });
      };

      // function to add the amount to an existing card
      $scope.addValue = function(){
        eftCayanService.Gift.Initiate({  // use EFT service to initiate gift transaction
          document_sid:DocumentPersistedData.DocumentInformation.Sid, // set document_sid based on persisted data
          actiontype:'GIFT_GIVE', // set action type to send to EFT for GIFT_GIVE
          amount:MWData.tenderAmount, // set amount based on sent data
          cardnumber:$scope.form.keyedCardData,  // set cardnumber based on keyedCardData
          rawtrackdata:$scope.form.cardData, //  set rawtrackdata based on cardData
          usegeniusdevice:false, // set usegeniusdevice to false (genius device cant swipe for balance)
          forcedupcheck:true // set forcedupcheck to true
        }).then(function(balData){
          var balance = balData[0]; // set balance to the first element of the returned data
          balance.addtender = balance.approvalstatus.toLowerCase() === 'approved'; // set to true if the transaction was approved
          balance.mode = 'Give'; // set the mode to 'Give' as adding value is a "change" transaction
          if(balance.approvalstatus !== 'ERROR'){
            $modalInstance.close(balance); // close the modal.
          }
        },function(data) {
          $scope.displayError(data); // run the display error function with data returned from the EFT
        });
      };

      // function to add the amount to a brand new card card
      $scope.activateCard = function(){
        eftCayanService.Gift.Initiate({  // use EFT service to initiate gift transaction
          document_sid:DocumentPersistedData.DocumentInformation.Sid, // set document_sid based on persisted data
          actiontype:'GIFT_ACTIVATE', // set action type to send to EFT for GIFT_ACTIVATE
          amount:MWData.tenderAmount, // set amount based on sent data
          cardnumber:$scope.form.keyedCardData,  // set cardnumber based on keyedCardData
          rawtrackdata:$scope.form.cardData, //  set rawtrackdata based on cardData
          usegeniusdevice:false, //set usegeniusdevice to false (genius device cant swipe for balance)
          forcedupcheck:true // set forcedupcheck to true
        }).then(function(createdCard){
          var newCard = createdCard[0];// set balance to the first element of the returned data
          newCard.addtender = newCard.approvalstatus.toLowerCase() === 'approved';// set to true if the transaction was approved
          newCard.mode = 'Give'; // set the mode to 'Give' as adding value is a "change" transaction
          if(newCard.approvalstatus !== 'ERROR') {
            $modalInstance.close(newCard); // close the modal return with data
          }
        },function(data) {
          $scope.displayError(data); // run the display error function with data returned from the EFT
        });
      };

      $scope.processTender = function(cardTender){
        var newCard = cardTender[0]; // set newCard to the first element of the returned data
        newCard.addtender = newCard.approvalstatus.toLowerCase() === 'approved'; // set to true if the transaction was approved
        newCard.mode = MWData.tenderMode; // Set the mode to the MWData.tenderMode
        if(newCard.approvalstatus !== 'ERROR') {
          $modalInstance.close(newCard); // close the modal return with data
        }
      };

      // function to use gift card to tender the transaction
      $scope.tenderGiftCard = function(){
        $scope.gcAction = MWData.tenderMode === 'Take' ? 'GIFT_TAKE' : 'GIFT_GIVE' // Set gcAction based on tenderMode
        eftCayanService.Gift.Initiate({ // use EFT service to initiate gift transaction
          document_sid:DocumentPersistedData.DocumentInformation.Sid, // set document_sid based on persisted data
          actiontype:$scope.gcAction, // Set the actiontype based on the gcAction
          amount:MWData.tenderAmount,  // set amount based on sent data
          cardnumber:$scope.form.keyedCardData, // set cardnumber based on keyedCardData
          rawtrackdata:$scope.form.cardData, //  set rawtrackdata based on cardData
          usegeniusdevice:false, //set usegeniusdevice to false (genius device cant swipe for balance)
          forcedupcheck:true // set forcedupcheck to true
        }).then(function(cardTender){
          if((cardTender[0].amount < MWData.tenderAmount) && cardTender[0].amount > 0){
            // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.','Insufficient Giftcard Balance'
            NotificationService.addAlert('3231','3232').then(function(){
              $scope.processTender(cardTender);
            });
          } else if(cardTender[0].amount === 0) {
            // Untranslated text 'Giftcard has no balance.  An additional payment source is required.','Insufficient Giftcard Balance'
            NotificationService.addAlert('4297','3232').then(function(){
              $modalInstance.close(false);
            });
          } else {
            $scope.processTender(cardTender);
          }
        },function(data) {
          $scope.displayError(data); // run the display error function with data returned from the EFT
        });
      };

      //function to handle and display any errors that occur
      $scope.displayError = function(data){
        var errorOutput = data.data[0]; // store returned error in easier to access variable
        switch (data.status) { // switch based on error status
          case 500:
            switch (errorOutput.errorcode) {
              case 9705:
                $modalInstance.close();
                // Untranslated text 'Invalid card swipe, or card swipe not from Cayan supported device.', 'Gift Card Error'
                NotificationService.addAlert('3385','3361').then(function(){
                  $modalInstance.close();
                });
                break;
              case 9702:
                $modalInstance.close();
                // Untranslated text 'Invalid amount.', 'Gift Card Error'
                NotificationService.addAlert('3386','3361').then(function(){
                  $modalInstance.close();
                });
                break;
              default:
                $modalInstance.close();
                // Untranslated Text 'Gift Card Error'
                NotificationService.addAlert(errorOutput.errormsg, '3361').then(function(){
                  $modalInstance.close();
                });
                break;
            }
            break;
        }
      };

      $scope.printBalance = function(){
        DocumentPersistedData.PrintDesignData.Payload = $scope.printData;
        $scope.printSpec = [$scope.printData]; // add print payload to printSpec data inside an array
        PrintersService.printAction(null,'Gift Card Balance',$scope.printSpec); // initiate print action to
      };
    }
  ]);
