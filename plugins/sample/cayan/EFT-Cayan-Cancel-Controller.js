window.angular.module('prismPluginsSample.controller.cayanCancelController', [])
  .controller('cayanCancelController', ['$scope', '$modalInstance',
    function ($scope, $modalInstance) {
      'use strict';

      $scope.closeForm = function (closeAction) { // define function to close modal
        $modalInstance.close(closeAction); // close the modal, pass the closeAction variable
      };
    }
  ]);
