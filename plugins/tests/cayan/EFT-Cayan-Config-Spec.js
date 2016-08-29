// example-spec.js
  var loginPage = {
    unInput : element(by.model('credentials.username')),
    pwInput : element(by.model('credentials.password')),
    get : function() {
      browser.get('https://lvaughan0-vms.retailpro.com:8080');
    },
    setName : function(name){
      this.unInput.sendKeys(name);
    },
    setPw : function(pw){
      this.pwInput.sendKeys(pw);
    }
  };

  var transactionPage = {
    itemInput : element(by.model('searchFields.item_lookup')),
    setItem : function(item){
      this.itemInput.sendKeys(item);
    }
  }


describe('EFT Cayan Credit Card Config Plugin - ', function(){
  'use strict';
    it('should log into the site', function() {
      loginPage.get();
      loginPage.setName('sysadmin');
      loginPage.setPw('sysadmin');

      element(by.id('loginButton')).click();
      browser.sleep('5000');
      expect(element(by.id('newTransactionButton')).isPresent()).toBe(true);
    });

    it('should create a new transaction', function(){
      element(by.id('newTransactionButton')).click();
      browser.sleep('3000');
      expect(element(by.id('tenderbutton')).isPresent()).toBe(true);
    });

    it('should create a document to be tendered', function(){
      transactionPage.setItem('17');
      browser.actions().sendKeys(protractor.Key.ENTER).perform();
      browser.sleep('1000');
      expect(element.all(by.repeater('thisTransactionItem in document.items')).count()).toEqual(1);
      element(by.id('tenderbutton')).click();
      browser.sleep('1000');
      expect(element(by.model('tender.amount')).isPresent()).toBe(true);
    });

    it('should change the tender type', function(){
      element(by.id('tendertype-tab')).click();
      browser.sleep('1000');
      element(by.id('CreditButton')).click();
      expect(element(by.binding('tenderName')).getText()).toBe('Take Credit Card');
    });

    // Not sure if we should test a bypass or try and test a response that requires a swipe
    //it('should take the credit card tender through Cayan', function(){
    //  element(by.id('takeButton')).click();
    //  browser.sleep('3000');
    //  expect(element(by.id('bypassButton')).isPresent()).toBe(true);
    //  element(by.id('bypassButton')).click();
    //  browser.sleep('3000');
    //});

  });
