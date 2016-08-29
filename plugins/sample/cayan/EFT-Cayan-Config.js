/**
 * ButtonHook to run before the posTenderTake and posTenderGive events
 * Checks the tender type and if credit, debit or gift runs through EFT provider
 * otherwise returns control to prism
 */
ButtonHooksManager.addHandler(['before_posTenderTake','before_posTenderGive'],
  function($q, $modal, $resource, DocumentPersistedData, PrismUtilities, NotificationService, Templates, ModelService, prismSessionInfo, eftCayanService, CreditCardTypes, $timeout, $http, TenderTypes, PrintersService,ShopperDisplay) {
    var deferred = $q.defer();
    // Declare variables for future use
    var document = [], // To store document information
      cayanData = [], // To store data from EFT Provider
      tender = [{ // To store Tender information
        amount:DocumentPersistedData.DocumentInformation.Tenders.CurrentAmt, // Tender amount from tender screen
        mode:DocumentPersistedData.DocumentInformation.Tenders.CurrentMode, // Tender Mode (take/give)
        type: DocumentPersistedData.DocumentInformation.Tenders.CurrentType, // Tender type (as integer)
        authcode: DocumentPersistedData.DocumentInformation.Tenders.AuthCode, //Tender Auth code
        forceCreditAuth: DocumentPersistedData.DocumentInformation.Tenders.forceCreditAuth // Tender Auth
      }],
      sequence,// Gets assigned below, after document is retrieved
      sessionInfo = prismSessionInfo.get(), // Configuring settings and calls to server module
      MWCardTypes = CreditCardTypes.getMWCardTypes(),
      documentParams = {sid:DocumentPersistedData.DocumentInformation.Sid,cols:'*'}, // Parameters to pass when requesting document
      seqParams = {subsidiary_sid:sessionInfo.subsidiarysid,cols:'*',filter:'(document_kind,eq,13)AND(seq_level,eq,0)'},
      printSid = 1,
      printData = {
      'store_name': '',
      'store_number': '',
      'store_code': '',
      'store_address_line1': '',
      'store_address_line2': '',
      'store_address_line3': '',
      'store_address_line4': '',
      'store_address_line5': '',
      'store_address_zip': '',
      'store_phone': '',
      'created_datetime': new Date().toISOString(),  // now
      'card_type': '',
      'card_number': '',
      'amount': '',
      'emv_appinfo_aid': '',
      'emv_appinfo_applicationlabel': '',
      'emv_cardinfo_cardexpirydate': '',
      'emv_crypto_cryptogram': '',
      'emv_crypto_cryptogramtype': '',
      'emv_pinstatement': '',
      'cashier_login_name': '',
      'employee1_login_name': ''
      },
      printSpec = {
      quantity: '1',
      design: prismSessionInfo.get().preferences.peripherals_output_deniedreceipts_print_design,
      printer: prismSessionInfo.get().preferences.peripherals_output_deniedreceipts_print_printer,
      printOrder: '',
      email: DocumentPersistedData.BillToCustomerData.EmailAddress,
      whatToPrint:[]
    },
    creditAction = 'CREDIT_' + tender[0].mode.toUpperCase(),
    authcode = '';

    /**
     * Function to process modal for credit card transactions
     * @param overrideDupeChecking
     */
    function creditTransaction(overrideDupeChecking){
      if(PrismUtilities.toBoolean(tender[0].forceCreditAuth)){
        creditAction = 'CREDIT_FORCE';
        authcode = tender[0].authcode;
      }
      eftCayanService.Credit.Initiate({
        document_sid: document.sid,
        eft_invc_no: sequence,
        actiontype: creditAction,
        amount: tender[0].amount,
        usegeniusdevice: false,
        forcedupcheck: overrideDupeChecking,
        authcode: authcode,
        web_redirect: location.href + '/eftmw//' + tender[0].mode
      }).then(function (creditInit) {
        cayanData = creditInit[0];
        return eftCayanService.Credit.Update({
          web_redirect: location.href + '/eftmw/' + cayanData.sid + '/' + tender[0].mode + '/' + sessionStorage.getItem('PRISMAUTH'),
          'row_version': cayanData.row_version,
          sid: cayanData.sid
        });
      }).then(function () {
        //doing this outside of angular for now.
        ShopperDisplay.Redraw(); // redraw shopper display
        location.href = sessionInfo.preferences.eft_mw_web_transaction_server + cayanData.transportkey;
      });
    }

    /**
     * Function to process modal for gift card transactions
     * @param mode
     */
    function giftCardTransaction(mode){
        cayanData = {giftMode:mode, tenderMode:tender[0].mode, tenderAmount:tender[0].amount}; // set cayandata values to send to EFT provider
        var cayanGiftCardModalPromise = $modal.open({ // create promise for modal
          backdrop:'static',
          keyboard:false,
          templateUrl:  '/plugins/sample/cayan/EFT-Cayan-Gift.htm', // set url for template html
          controller: 'cayanGiftCardController', // define controller for modal
          resolve: {
            MWData:function(){return cayanData;} // set variables to resolve
          }
        });


        cayanGiftCardModalPromise.result.then(function(giftCardReturnValues){  // define function for resolution of modal promise
          if(giftCardReturnValues.addtender){ // verify that there is an addtender value returned from eft provider
            tender[0].amount = giftCardReturnValues.amount; // set the tender amount to the return amount
            var newTender = ModelService.create('Tender'); // create new tender object
            newTender.tender_type = 10; // set tender type to 10 for giftcard
            newTender.document_sid = document.sid; // set tender document sid
            if(giftCardReturnValues.mode === 'Take'){ // set taken or given based on return mode
              newTender.taken = giftCardReturnValues.amount;
            } else {
              newTender.given = giftCardReturnValues.amount;
            }
            newTender.balance = giftCardReturnValues.balance; // set new balance of card based on return balance
            newTender.authorization_code = giftCardReturnValues.authcode; // set authorization code based on return authcode
            newTender.card_number = giftCardReturnValues.cardnumber.substr(giftCardReturnValues.cardnumber.length - 6);  // set card_number to last 6 digits of returned cardnumber
            var mwCardTypes = CreditCardTypes.getMWCardTypes(); // set mwCardTypes based on mwcard types function
            newTender.tender_name = mwCardTypes[giftCardReturnValues.paymenttype].name; // set tender name based on available card names
            newTender.eft_transaction_id = giftCardReturnValues.token; // set eft_transaction_id based on return token
            newTender.eftdata1 = MWCardTypes[parseInt(giftCardReturnValues.paymenttype)].sid;  // set eftdata1 with card type data
            document.addTender(newTender).then(function () { //add the tender to the document
              location.reload();  // reload the browser window to redraw the updated document
            }, function(data) { // functions to run if the server responds with an error
              var errorOutput = data.data[0];
              switch (data.status) {
                case 408:
                  switch (errorOutput.errorcode) {
                    case 265:
                      //('Gift Cards may not be used as a Give tender.', 'Gift Card Error'); // Untranslated values for the error
                      NotificationService.addAlert('3360', '3361');
                      break;
                    default:
                      break;
                  }
                  break;
                default:
                  break;
              }
            });
          } else {
            if(giftCardReturnValues.actiontype !== 'GIFT_BALANCE' && giftCardReturnValues !== false){
              if(!giftCardReturnValues.errormessage && ( giftCardReturnValues.amount < tender[0].amount) ){
                // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.'
                NotificationService.addAlert('3231', giftCardReturnValues.approvalstatus);
              } else if(!giftCardReturnValues.errormessage && (giftCardReturnValues.approvalstatus === 'DECLINED')){
                NotificationService.addAlert('4299', giftCardReturnValues.approvalstatus);
              } else {
                NotificationService.addAlert(giftCardReturnValues.errormessage, giftCardReturnValues.approvalstatus);
              }
            }
          }
        });
    };

    /**
     * Function to process credit card transactions that returned a duplicate transaction error
     * from EFT provider
     */
    function duplicateTransactionPrompt(){
      //('The requested transaction was determined to be a duplicate of a previous transaction. Would you like to resend the transaction attempt without duplicate detection?', 'DECLINED, DUPLICATE'); // Untranslated values for the message
      var runNoDupes = NotificationService.addConfirm('2414', '2415');
      runNoDupes.then(function(decision){
        if(decision){
          geniusDevicePrompt(true);
        }
      });
    };

    /**
     *
     * @param overrideDupeChecking
     */
    function geniusDevicePrompt(overrideDupeChecking){
      var dupCheck = overrideDupeChecking || DocumentPersistedData.DocumentInformation.DuplicateTransaction;
      DocumentPersistedData.DocumentInformation.DuplicateTransaction = false; // reset value
      if(PrismUtilities.toBoolean(tender[0].forceCreditAuth)){  // check if forceCreditAuth is true
        creditAction = 'CREDIT_FORCE'; // set creditAction
        authcode = tender[0].authcode; // set authcode
      }
        eftCayanService.Credit.Initiate({ // Initiate credit transaction with the EFT service
          document_sid: document.sid, // set document_sid
          eft_invc_no: sequence, // set eft_invc_no
          actiontype: creditAction, // set actiontype
          amount: tender[0].amount, // set amount
          usegeniusdevice: true, // set usegeniusdevice
          forcedupcheck: dupCheck, // set forcedupcheck
          authcode: authcode, // set authcode
        }).then(function(creditInit){ // set what to do after CED responds with creditInit value
          creditInit[0].debit = parseInt(tender[0].type) === 11; // set debit to true if tender type = 11
          var cayanCreditModalPromise = $modal.open({ // create promise and open modal
            backdrop:'static',
            keyboard:false,
            windowClass:'full', // sets class on modal to full makes modal fill screen
            templateUrl: '/plugins/sample/cayan/EFT-Cayan-Device.htm', //set template url
            controller: 'cayanDeviceController', // set controller for modal
            resolve: {
              MWData:function(){return angular.copy(creditInit[0]);} // send creditInit to controller as MWData
            }
          });
          cayanCreditModalPromise.result.then(function(returnObject){
          // check if the eft provider returned with a positive response to add the tender
          if(returnObject.addtender){
            //Start process of creating new tender entry in the document tender table
            var newTender = ModelService.create('Tender');
            //Sets the tender type
            newTender.tender_type = returnObject.mwdata.tendertype;
            //Sets the document_sid
            newTender.document_sid = document.sid;
            //Updates the documents amount due (this may need to be removed based on condensed code)
            document.due_amt -= tender[0].amount;
            //Sets the Authorization Code
            newTender.authorization_code = returnObject.mwdata.authcode;
            //Sets the Card Number
            newTender.card_number = returnObject.mwdata.cardnumber;
            //Sets the tender amount
            if(tender[0].mode === 'Take'){
              newTender.taken = returnObject.mwdata.amount;
            } else {
              newTender.given = returnObject.mwdata.amount;
            }
            //Sets the tender name
            if(returnObject.mwdata.card_type_desc.length > 0){
              newTender.tender_name = returnObject.mwdata.card_type_desc.substr(0, 25);
            } else {
              newTender.tender_name = newTender.printName();
            }
            //Sets the Transaction ID from the Returned Token
            newTender.eft_transaction_id = returnObject.mwdata.token;
            //Stores the returned card type into EFT Data field
            newTender.eftdata1 = returnObject.mwdata.card_type;
            //Stores the returned EMV AI AID
            newTender.emv_ai_aid = returnObject.mwdata.emv_ai_aid;
            //Stores the returned EMV AI APP LABEL
            newTender.emv_ai_applabel = returnObject.mwdata.emv_ai_applabel;
            //Stores the returned EMV Card Exp Date
            newTender.emv_ci_cardexpirydate = returnObject.mwdata.emv_ci_cardexpirydate;
            //Stores the returned EMV Crypto Cryptogram Type
            newTender.emv_crypto_cryptogramtype = returnObject.mwdata.emv_crypto_cryptogramtype;
            //Stores the returned EMV Crypto Cryptogram
            newTender.emv_crypto_cryptogram = returnObject.mwdata.emv_crypto_cryptogram;
            //Stores the returned EMV Pin Statement
            newTender.emv_pinstatement = returnObject.mwdata.emv_pinstatement;

            if(returnObject.mwdata.errormessage === 'APPROVED_No_Signature'){
              //'Transaction Approved, No Signature Collected', 'No Signature' // Untranslated values for the message
              NotificationService.addNotification('2412', '2413');
            }
            //Adds tender to the document object using the document BO
            document.addTender(newTender).then(function () {
              //Get the existing document
              ModelService.get('Document', documentParams)
                .then(function(){
                  //Check if returned object was a gift card and had an approved amount that was less than the tendered amount
                  if((returnObject.mwdata.amount < tender[0].amount)&&(returnObject.mwdata.card_type === "GIFT") ){
                    // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.'
                      if(!returnObject.mwdata.errormessage && (returnObject.mwdata.amount < tender[0].amount) ){
                        // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.'
                        NotificationService.addAlert('3231', returnObject.mwdata.approvalstatus).then(function(){
                          // Reload page to show added tenders
                          location.reload();
                        });;
                      } else if(!returnObject.mwdata.errormessage && (returnObject.mwdata.approvalstatus === 'DECLINED')){
                        NotificationService.addAlert('4299', returnObject.mwdata.approvalstatus).then(function(){
                          // Reload page to show added tenders
                          location.reload();
                        });;
                      } else {
                        NotificationService.addAlert(returnObject.mwdata.errormessage, returnObject.mwdata.approvalstatus).then(function(){
                          // Reload page to show added tenders
                          location.reload();
                        });;
                      }
                  } else {
                    // Reload page to show added tenders
                    location.reload();
                  }

                });
            });
          } else {
            // if response from eft provider is to run without the CED
            if(returnObject.runWithoutDevice){
                if(parseInt(tender[0].type) === 10){ // If tender type is 10 run gift card process
                    giftCardTransaction();
                } else {  // run credit transaction instead
                    creditTransaction(dupCheck);
                }
              deferred.reject();
            } else {
              if(returnObject.mwdata.approvalstatus === 'DECLINED_DUPLICATE'){
                $timeout(function(){
                  duplicateTransactionPrompt();
                }, 500);
              } else {
                // Throw error containing response from the EFT Provider
                //check the EMV fields - if any are not blank, print the declined receipt...
                var EMVDataExists = returnObject.mwdata.emv_ai_aid.length > 0 ||
                  returnObject.mwdata.emv_ai_applabel.length > 0 ||
                  returnObject.mwdata.emv_ci_cardexpirydate.length > 0 ||
                  returnObject.mwdata.emv_crypto_cryptogramtype.length > 0 ||
                  returnObject.mwdata.emv_crypto_cryptogram.length > 0 ||
                  returnObject.mwdata.emv_pinstatement.length > 0 ;
                  if((returnObject.mwdata.amount < tender[0].amount)&&(returnObject.mwdata.card_type === "GIFT") ){
                    if(!returnObject.mwdata.errormessage && ( returnObject.mwdata.amount < tender[0].amount) ){
                      // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.'
                      NotificationService.addAlert('3231', returnObject.mwdata.approvalstatus).then(function(){
                        if(EMVDataExists) {
                          printDeclinedReceipt(returnObject.mwdata);
                        }
                      });
                    } else if(!returnObject.mwdata.errormessage && (returnObject.mwdata.approvalstatus === 'DECLINED' || returnObject.mwdata.approvalstatus === 'DECLINED;MP')){
                      NotificationService.addAlert('4299', returnObject.mwdata.approvalstatus).then(function(){
                        if(EMVDataExists) {
                          printDeclinedReceipt(returnObject.mwdata);
                        }
                      });
                    } else {
                      NotificationService.addAlert(returnObject.mwdata.errormessage, returnObject.mwdata.approvalstatus).then(function(){
                        if(EMVDataExists) {
                          printDeclinedReceipt(returnObject.mwdata);
                        }
                      });
                    }
                  } else {
                    NotificationService.addAlert(returnObject.mwdata.errormessage, returnObject.mwdata.approvalstatus)
                      .then(function(){
                        if(EMVDataExists) {
                          printDeclinedReceipt(returnObject.mwdata);
                        }
                      });
                  }
                deferred.reject();
              }
            }
          }
        });
      });
    }

    /** function to handle the printing of declined receipts based on preferences in the admin console **/
    function printDeclinedReceipt(EMVData) {
      DocumentPersistedData.PrintDesignData.PrintType = 'creditinfo'; // set PrintType in the documentpersisteddata
      DocumentPersistedData.PrintDesignData.Title = 'Declined Receipt'; // set Title to print in the documentpersisteddata
      DocumentPersistedData.PrintDesignData.Design = prismSessionInfo.get().preferences.peripherals_output_deniedreceipts_print_design; // set the design based on stored preference data
      DocumentPersistedData.PrintDesignData.Printer = prismSessionInfo.get().preferences['peripherals_output_documents_print_printer']; // set the printer bsaed on stored preference data

     // use the Model service to get the store information
      ModelService.get('Store', {
        sid: prismSessionInfo.get().storesid,
        cols: 'address1,address2,address3,address4,address5,phone1,store_name,store_code,store_number,zip' // specify the columns to return from the DB
      }).then(function (data) {

        //Set up the payload of data to print
        printData = {
          'store_name': data[0].store_name,
          'store_number': data[0].store_number,
          'store_code': data[0].store_code,
          'store_address_line1': data[0].address1,
          'store_address_line2': data[0].address2,
          'store_address_line3': data[0].address3,
          'store_address_line4': data[0].address4,
          'store_address_line5': data[0].address5,
          'store_address_zip': data[0].zip,
          'store_phone': data[0].phone1,
          'card_type': EMVData.card_type,
          'card_number': EMVData.cardnumber,
          'amount': DocumentPersistedData.DocumentInformation.Tenders.CurrentAmt,
          'emv_appinfo_aid': EMVData.emv_appinfo_aid,
          'emv_appinfo_applicationlabel': EMVData.emv_appinfo_applicationlabel,
          'emv_cardinfo_cardexpirydate': EMVData.emv_cardinfo_cardexpirydate,
          'emv_crypto_cryptogram': EMVData.emv_crypto_cryptogram,
          'emv_crypto_cryptogramtype': EMVData.emv_crypto_cryptogramtype,
          'emv_pinstatement': EMVData.emv_pinstatement
        };
      }).then(function() {
        // specify the params to pass when getting the document
        var docParams = {
          sid: DocumentPersistedData.DocumentInformation.Sid,
          cols: 'document_number,cashier_login_name,employee1_login_name'// specify the columns to return from the DB
        };

        ModelService.get('Document', docParams) // use the Model service to get the current document
          .then(function (data) {
            printData.cashier_login_name = data[0].cashier_login_name;  // set the returned cashier to printData
            printData.employee1_login_name = data[0].employee1_login_name; // set the returned employee to printData
            DocumentPersistedData.PrintDesignData.Payload = printData; // add printData to the DPD print data Payload
            printSpec.whatToPrint.push(DocumentPersistedData.PrintDesignData.Payload); // push the entire Payload into the WhatToPrint array
          }).then(function() {
            PrintersService.printAction(null,'EFT Information',printSpec.whatToPrint);
          });
      });
    };

    function getTenderRule(tenderPref,index){ // function to get value of specific tender rule
      var cut=tenderPref.split(','); // split preference into array by comma
      if(index==='oTender'){  //check if the index equals oTender
        if(cut[1]){
          return cut[1];  // return value of cut[1]
        }else{
          return 0; // return zero
        }
      }
      var bools=cut[0].split('');  // split cut
      return bools[index]==='T';  // return true if value at index is T
    };

    /** Logic check that starts the process if the tender amount is not zero and the tender type matches one of
     * the correct tender types supported by the EFT provider.
     **/
    if(
      // Credit Card
      tender[0].type === 2 ||
      // Gift Card
      tender[0].type === 10 ||
      // Debit Card
      tender[0].type === 11 )
    {
      //Verify that the tender amount is not zero
      if(parseFloat(tender[0].amount) === 0){
        // Throw error if amount is zero
        //'Amount must be greater than 0', 'Missing Amount'// Untranslated values for the message
        NotificationService.addAlert('2400', '2401').then(function(){
          // exit the plugin and cancel tender process
          deferred.reject();
          return;
        });
      } else {
        ModelService.get('Document',documentParams).then(function(data){
          document = data[0];
          sequence = document.eft_invoice_number;
            if(TenderTypes.getPrefName(tender[0].type)){
              var tName= TenderTypes.getPrefName(tender[0].type);
              var oTender= getTenderRule(sessionInfo.preferences['pos_tenders_rules_' + tName],'oTender');
              if(tender[0].mode==='Take'){
                if((tender[0].amount - document.due_amt) > oTender){
                  // Untranslated Text ('Take Value Exceeds Maximum Over Tender Amount','Error')
                  NotificationService.addAlert('3276','1185');
                  deferred.reject();
                  return;
                }
              }
            }

            switch(tender[0].type){
              case 2:
                // check preferences to see if merchant key has been defined
                if(sessionInfo.preferences.eft_mw_merchant_key.length > 0){
                  // check preferences to see if CED has been enabled
                    if(PrismUtilities.toBoolean(sessionInfo.preferences.eft_mw_use_genius_device)){
                        //hand off to genius device
                        geniusDevicePrompt(false);
                    } else {
                      // process credit card transaction without CED
                        creditTransaction(false);
                    }
                } else {
                  // exit the plugin and process the tender normally in Prism
                  deferred.resolve();
                }
                break;
              case 10:
                // check preferences to see if merchant key has been defined
                if(sessionInfo.preferences.eft_mw_merchant_key.length > 0){
                  // check preferences to see if CED has been enabled
                  if(PrismUtilities.toBoolean(sessionInfo.preferences.eft_mw_use_genius_device)){
                    //'Do you want to use the customer-facing card reader?', 'Use Device?'//Untranslated values for the message
                    NotificationService.addConfirm('2404', '2405').then(function(useDevice){
                        if(useDevice){
                          //hand off to genius device
                          geniusDevicePrompt(false);
                        } else {
                          // process gift card transaction without CED
                          giftCardTransaction();
                        }
                    });
                  } else {
                    // process gift card transaction without CED
                      giftCardTransaction();
                  }
                } else {
                  // exit the plugin and process the tender normally in Prism
                  deferred.resolve();
                }
                break;
              case 11:
                // check preferences to see if merchant key has been defined
                if(sessionInfo.preferences.eft_mw_merchant_key.length > 0){
                    if(tender[0].mode === 'Give'){
                      //'Debit returns are not allowed.', 'No Debit Returns'//Untranslated values for the message
                        NotificationService.addNotification('2406', '2407', true, true);
                    } else {
                      //hand off to genius device
                      geniusDevicePrompt(false);
                    }
                } else {
                  // exit the plugin and process the tender normally in Prism
                  deferred.resolve();
                }
                break;
            }
        });
      }
    } else {
      // exit the plugin and process the tender normally in Prism
      deferred.resolve();
    }

    return deferred.promise;
  }
);

/**
 * ButtonHook to run before the posTenderGiftCardBalance event
 * Processes gift card information through EFT provider and returns with the balance of gift card
 */
ButtonHooksManager.addHandler('before_posTenderGiftCardBalance',
  function($q, $modal, $resource, DocumentPersistedData, PrismUtilities, NotificationService, Templates, ModelService, CreditCardTypes) {
    var deferred = $q.defer();
    // Declare variables for future use
    var document = [], // To store document information
      cayanData = [], // To store data from EFT Provider
      tender = [{ // To store Tender information
        amount: DocumentPersistedData.DocumentInformation.Tenders.CurrentAmt, // Tender amount from tender screen
        mode: DocumentPersistedData.DocumentInformation.Tenders.CurrentMode, // Tender Mode (take/give)
        type: DocumentPersistedData.DocumentInformation.Tenders.CurrentType, // Tender type (as integer)
        authcode: DocumentPersistedData.DocumentInformation.Tenders.AuthCode, //Tender Auth code
        forceCreditAuth: false
      }],
      MWCardTypes = CreditCardTypes.getMWCardTypes(),
      documentParams = {sid: DocumentPersistedData.DocumentInformation.Sid, cols: '*'}; // Parameters to pass when requesting document

    ModelService.get('Document',documentParams).then(function(data){document = data[0];});

    cayanData = {giftMode: 'balance', tenderMode: tender[0].mode, tenderAmount: tender[0].amount};

    var cayanGiftCardModalPromise = $modal.open({
      backdrop: 'static',
      keyboard: false,
      templateUrl: '/plugins/sample/cayan/EFT-Cayan-Gift.htm',
      controller: 'cayanGiftCardController',
      resolve: {
        MWData: function () {
          return cayanData;
        }
      }
    });
    cayanGiftCardModalPromise.result.then(function (giftCardReturnValues) {
      if (giftCardReturnValues.addtender) {
        tender[0].amount = giftCardReturnValues.amount;
        var newTender = ModelService.create('Tender');
        newTender.tender_type = 10;
        newTender.document_sid = document.sid;
        if (giftCardReturnValues.mode === 'Take') {
          newTender.taken = giftCardReturnValues.amount;
        } else {
          newTender.given = giftCardReturnValues.amount;
        }
        newTender.balance = giftCardReturnValues.balance;
        newTender.authorization_code = giftCardReturnValues.authcode;
        newTender.card_number = giftCardReturnValues.cardnumber.substr(giftCardReturnValues.cardnumber.length - 6);
        var mwCardTypes = CreditCardTypes.getMWCardTypes();
        newTender.tender_name = mwCardTypes[giftCardReturnValues.paymenttype].name;
        newTender.eft_transaction_id = giftCardReturnValues.token;
        newTender.eftdata1 = MWCardTypes[parseInt(giftCardReturnValues.paymenttype)].sid;
        document.addTender(newTender).then(function () {
          ModelService.get('Document', documentParams)
            .then(function (data) {
              document = data[0];
              deferred.resolve();
            });
        }, function (data) {
          var errorOutput = data.data[0];
          switch (data.status) {
            case 408:
              switch (errorOutput.errorcode) {
                case 265:
                  //('Gift Cards may not be used as a Give tender.', 'Gift Card Error'); // Untranslated values for the error
                  NotificationService.addAlert('3360', '3361');
                  break;
                default:
                  break;
              }
              break;
            default:
              break;
          }
        });
      } else {
        if(giftCardReturnValues.actiontype !== 'GIFT_BALANCE' && giftCardReturnValues !== false){
          if(!giftCardReturnValues.errormessage && ( giftCardReturnValues.amount < tender[0].amount) ){
            // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.'
            NotificationService.addAlert('3231', giftCardReturnValues.approvalstatus);
          } else if(!giftCardReturnValues.errormessage && (giftCardReturnValues.approvalstatus === 'DECLINED')){
            NotificationService.addAlert('4299', giftCardReturnValues.approvalstatus);
          } else {
            NotificationService.addAlert(giftCardReturnValues.errormessage, giftCardReturnValues.approvalstatus);
          }
        }
      }
    });
    return deferred.promise;
  }
);

/**
 * ButtonHook to run before the posTenderGiftCardAddValue event
 * Processes gift card information through EFT provider and adds the inserted value to the indicated gift card
 */
ButtonHooksManager.addHandler('before_posTenderGiftCardAddValue',
  function($q, $modal, $resource, DocumentPersistedData, PrismUtilities, NotificationService, Templates, ModelService, CreditCardTypes) {
    var deferred = $q.defer();
    // Declare variables for future use
    var document = [], // To store document information
      cayanData = [], // To store data from EFT Provider
      tender = [{ // To store Tender information
        amount: DocumentPersistedData.DocumentInformation.Tenders.CurrentAmt, // Tender amount from tender screen
        mode: DocumentPersistedData.DocumentInformation.Tenders.CurrentMode, // Tender Mode (take/give)
        type: DocumentPersistedData.DocumentInformation.Tenders.CurrentType, // Tender type (as integer)
        authcode: DocumentPersistedData.DocumentInformation.Tenders.AuthCode, //Tender Auth code
        forceCreditAuth: false
      }],
      MWCardTypes = CreditCardTypes.getMWCardTypes(),
      documentParams = {sid: DocumentPersistedData.DocumentInformation.Sid, cols: '*'}; // Parameters to pass when requesting document
    ModelService.get('Document',documentParams).then(function(data){document = data[0];});
      cayanData = {giftMode: 'value', tenderMode: tender[0].mode, tenderAmount: tender[0].amount};
      var cayanGiftCardModalPromise = $modal.open({
        backdrop: 'static',
        keyboard: false,
        templateUrl: '/plugins/sample/cayan/EFT-Cayan-Gift.htm',
        controller: 'cayanGiftCardController',
        resolve: {
          MWData: function () {
            return cayanData;
          }
        }
      });
      cayanGiftCardModalPromise.result.then(function (giftCardReturnValues) {
        if (giftCardReturnValues.addtender) {
          tender[0].amount = giftCardReturnValues.amount;
          var newTender = ModelService.create('Tender');
          newTender.tender_type = 10;
          newTender.document_sid = document.sid;
          if (giftCardReturnValues.mode === 'Take') {
            newTender.taken = giftCardReturnValues.amount;
          } else {
            newTender.given = giftCardReturnValues.amount;
          }
          newTender.balance = giftCardReturnValues.balance;
          newTender.authorization_code = giftCardReturnValues.authcode;
          newTender.card_number = giftCardReturnValues.cardnumber.substr(giftCardReturnValues.cardnumber.length - 6);
          var mwCardTypes = CreditCardTypes.getMWCardTypes();
          newTender.tender_name = mwCardTypes[giftCardReturnValues.paymenttype].name;
          newTender.eft_transaction_id = giftCardReturnValues.token;
          newTender.eftdata1 = MWCardTypes[parseInt(giftCardReturnValues.paymenttype)].sid;
          document.addTender(newTender).then(function () {
            ModelService.get('Document', documentParams)
              .then(function (data) {
                document = data[0];
                // Reload page to show added tenders
                location.reload();
              });
          }, function (data) {
            var errorOutput = data.data[0];
            switch (data.status) {
              case 408:
                switch (errorOutput.errorcode) {
                  case 265:
                    //('Gift Cards may not be used as a Give tender.', 'Gift Card Error'); // Untranslated values for the error
                    NotificationService.addAlert('3360', '3361');
                    break;
                  default:
                    break;
                }
                break;
              default:
                break;
            }
          });
        } else {
          if(giftCardReturnValues.actiontype !== 'GIFT_BALANCE' && giftCardReturnValues !== false){
            if(!giftCardReturnValues.errormessage && ( giftCardReturnValues.amount < tender[0].amount) ){
              // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.'
              NotificationService.addAlert('3231', giftCardReturnValues.approvalstatus);
            } else if(!giftCardReturnValues.errormessage && (giftCardReturnValues.approvalstatus === 'DECLINED')){
              NotificationService.addAlert('4299', giftCardReturnValues.approvalstatus);
            } else {
              NotificationService.addAlert(giftCardReturnValues.errormessage, giftCardReturnValues.approvalstatus);
            }
          }
        }
      });
    return deferred.promise;
  }
);

/**
 * ButtonHook to run before the posTenderGiftCardPurchase event
 * Processes gift card information through EFT provider and adds the inserted value to a new gift card
 */
ButtonHooksManager.addHandler('before_posTenderGiftCardPurchase',
  function($q, $modal, $resource, DocumentPersistedData, PrismUtilities, NotificationService, Templates, ModelService, CreditCardTypes) {
    var deferred = $q.defer();
    // Declare variables for future use
    var document = [], // To store document information
      cayanData = [], // To store data from EFT Provider
      tender = [{ // To store Tender information
        amount: DocumentPersistedData.DocumentInformation.Tenders.CurrentAmt, // Tender amount from tender screen
        mode: DocumentPersistedData.DocumentInformation.Tenders.CurrentMode, // Tender Mode (take/give)
        type: DocumentPersistedData.DocumentInformation.Tenders.CurrentType, // Tender type (as integer)
        authcode: DocumentPersistedData.DocumentInformation.Tenders.AuthCode, //Tender Auth code
        authcode: DocumentPersistedData.DocumentInformation.Tenders.AuthCode, //Tender Auth code
        forceCreditAuth: false
      }],
      MWCardTypes = CreditCardTypes.getMWCardTypes(),
      documentParams = {sid: DocumentPersistedData.DocumentInformation.Sid, cols: '*'}; // Parameters to pass when requesting document
    ModelService.get('Document',documentParams).then(function(data){document = data[0];});
      cayanData = {giftMode: 'activate', tenderMode: tender[0].mode, tenderAmount: tender[0].amount};
      var cayanGiftCardModalPromise = $modal.open({
        backdrop: 'static',
        keyboard: false,
        templateUrl: '/plugins/sample/cayan/EFT-Cayan-Gift.htm',
        controller: 'cayanGiftCardController',
        resolve: {
          MWData: function () {
            return cayanData;
          }
        }
      });
      cayanGiftCardModalPromise.result.then(function (giftCardReturnValues) {
        if (giftCardReturnValues.addtender) {
          tender[0].amount = giftCardReturnValues.amount;
          var newTender = ModelService.create('Tender');
          newTender.tender_type = 10;
          newTender.document_sid = document.sid;
          if (giftCardReturnValues.mode === 'Take') {
            newTender.taken = giftCardReturnValues.amount;
          } else {
            newTender.given = giftCardReturnValues.amount;
          }
          newTender.balance = giftCardReturnValues.balance;
          newTender.authorization_code = giftCardReturnValues.authcode;
          newTender.card_number = giftCardReturnValues.cardnumber.substr(giftCardReturnValues.cardnumber.length - 6);
          var mwCardTypes = CreditCardTypes.getMWCardTypes();
          newTender.tender_name = mwCardTypes[giftCardReturnValues.paymenttype].name;
          newTender.eft_transaction_id = giftCardReturnValues.token;
          newTender.eftdata1 = MWCardTypes[parseInt(giftCardReturnValues.paymenttype)].sid;
          document.addTender(newTender).then(function () {
            ModelService.get('Document', documentParams)
              .then(function (data) {
                document = data[0];
                // Reload page to show added tenders
                location.reload();
              });
          }, function (data) {
            var errorOutput = data.data[0];
            switch (data.status) {
              case 408:
                switch (errorOutput.errorcode) {
                  case 265:
                    //('Gift Cards may not be used as a Give tender.', 'Gift Card Error'); // Untranslated values for the error
                    NotificationService.addAlert('3360', '3361');
                    break;
                  default:
                    break;
                }
                break;
              default:
                break;
            }
          });
        } else {
          if(giftCardReturnValues.actiontype !== 'GIFT_BALANCE' && giftCardReturnValues !== false){
            if(!giftCardReturnValues.errormessage && ( giftCardReturnValues.amount < tender[0].amount) ){
              // Untranslated text 'Giftcard balance is insufficient to complete transaction.  An additional payment source is required.'
              NotificationService.addAlert('3231', giftCardReturnValues.approvalstatus);
            } else if(!giftCardReturnValues.errormessage && (giftCardReturnValues.approvalstatus === 'DECLINED')){
              NotificationService.addAlert('4299', giftCardReturnValues.approvalstatus);
            } else {
              NotificationService.addAlert(giftCardReturnValues.errormessage, giftCardReturnValues.approvalstatus);
            }
          }
        }
      });

    return deferred.promise;
  }
);

/**
 * ButtonHook to run before the posOptionsGiftCardBalance event
 * Processes gift card information through EFT provider and returns with the balance of gift card and allows for printing
 */
ButtonHooksManager.addHandler('before_posOptionsGiftCardBalance',
  function($q, $modal, $resource, DocumentPersistedData, PrismUtilities, NotificationService, Templates, ModelService, CreditCardTypes) {
    var deferred = $q.defer();
    // Declare variables for future use
    var document = [], // To store document information
      cayanData = [], // To store data from EFT Provider
      tender = [{ // To store Tender information
        amount: DocumentPersistedData.DocumentInformation.Tenders.CurrentAmt, // Tender amount from tender screen
        mode: DocumentPersistedData.DocumentInformation.Tenders.CurrentMode, // Tender Mode (take/give)
        type: DocumentPersistedData.DocumentInformation.Tenders.CurrentType, // Tender type (as integer)
        forceCreditAuth: false
      }],
      MWCardTypes = CreditCardTypes.getMWCardTypes(),
      documentParams = {sid: DocumentPersistedData.DocumentInformation.Sid, cols: '*'}; // Parameters to pass when requesting document

    cayanData = {giftMode: 'balance', tenderMode: 'Take', tenderAmount: '0'};
    var cayanGiftCardModalPromise = $modal.open({
      backdrop: 'static',
      keyboard: false,
      templateUrl: '/plugins/sample/cayan/EFT-Cayan-Gift.htm',
      controller: 'cayanGiftCardController',
      resolve: {
        MWData: function () {
          return cayanData;
        }
      }
    });
    cayanGiftCardModalPromise.result.then(function (giftCardReturnValues) {
      if (giftCardReturnValues.addtender) {
        tender[0].amount = giftCardReturnValues.amount;
        var newTender = ModelService.create('Tender');
        newTender.tender_type = 10;
        newTender.document_sid = document.sid;
        if (giftCardReturnValues.mode === 'Take') {
          newTender.taken = giftCardReturnValues.amount;
        } else {
          newTender.given = giftCardReturnValues.amount;
        }
        newTender.balance = giftCardReturnValues.balance;
        newTender.authorization_code = giftCardReturnValues.authcode;
        newTender.card_number = giftCardReturnValues.cardnumber.substr(giftCardReturnValues.cardnumber.length - 6);
        var mwCardTypes = CreditCardTypes.getMWCardTypes();
        newTender.tender_name = mwCardTypes[giftCardReturnValues.paymenttype].name;
        newTender.eft_transaction_id = giftCardReturnValues.token;
        newTender.eftdata1 = MWCardTypes[parseInt(giftCardReturnValues.paymenttype)].sid;
        document.addTender(newTender).then(function () {
          ModelService.get('Document', documentParams)
            .then(function (data) {
              document = data[0];
              deferred.resolve();
            });
        }, function (data) {
          var errorOutput = data.data[0];
          switch (data.status) {
            case 408:
              switch (errorOutput.errorcode) {
                case 265:
                  //('Gift Cards may not be used as a Give tender.', 'Gift Card Error'); // Untranslated values for the error
                  NotificationService.addAlert('3360', '3361');
                  break;
                default:
                  break;
              }
              break;
            default:
              if(!giftCardReturnValues.errormessage && (giftCardReturnValues.approvalstatus === 'DECLINED')){
                  NotificationService.addAlert('4299', giftCardReturnValues.approvalstatus);
              } else {
                  NotificationService.addAlert(giftCardReturnValues.errormessage, giftCardReturnValues.approvalstatus);
              }
              break;
          }
        });
      }
    });
    return deferred.promise;
  }
);



/** Angular Service to monitor the URL in the browser to match the return URL from Cayan **/
angular.module('prismPluginsSample.module.cayanRouteModule', [], null)
  .config(function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/');

    $stateProvider // run the state provider service
      .state('transactionEditTenderMWTenderStatus', { // name the state were watching for
        url: '/register/pos/:screen/:document_sid/:mode/tender/eftmw/:eftmwSid/:tendermode/:auth', // specify the URL that we are using : indicates a variable
        templateUrl: function () {
          return '/plugins/sample/cayan/EFT-Cayan-SigCap.htm'; // set the URL for the modal that will pop
        },
        controller: 'cayanSigCapController', // set the controller for modal
        resolve: {
          Document: ['ModelService', '$stateParams', function(ModelService, $stateParams){ // send the modelservice and stateparams into the modal
            var docParams = { // specify data to send inside the Document variable
              sid: $stateParams.document_sid,   // set doc sid from the URL
              cols: {sid: $stateParams.document_sid, cols: '*'} // specify cols argument to send
            };

            return ModelService.get('Document', docParams).then(function(data){ // specify what to return
              var doc = data[0];
              doc.params = docParams;
              return doc;
            });
          }]
        }
      });
  });
