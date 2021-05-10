/**
 * @file
 * Some basic behaviors and utility functions for Views.
 */
(function ($) {

  Drupal.Views = {};

  /**
   * JQuery UI tabs, Views integration component.
   */
  Drupal.behaviors.viewsTabs = {
    attach: function (context) {
      if ($.viewsUi && $.viewsUi.tabs) {
        $('#views-tabset').once('views-processed').viewsTabs({
          selectedClass: 'active'
        });
      }

      $('a.views-remove-link').once('views-processed').click(function(event) {
        var id = $(this).attr('id').replace('views-remove-link-', '');
        $('#views-row-' + id).hide();
        $('#views-removed-' + id).attr('checked', true);
        event.preventDefault();
      });
      /**
    * Here is to handle display deletion
    * (checking in the hidden checkbox and hiding out the row).
    */
      $('a.display-remove-link')
        .addClass('display-processed')
        .click(function() {
          var id = $(this).attr('id').replace('display-remove-link-', '');
          $('#display-row-' + id).hide();
          $('#display-removed-' + id).attr('checked', true);
          return false;
        });
    }
  };

  /**
 * Helper function to parse a querystring.
 */
  Drupal.Views.parseQueryString = function (query) {
    var args = {};
    var pos = query.indexOf('?');
    if (pos != -1) {
      query = query.substring(pos + 1);
    }
    var pairs = query.split('&');
    for (var i in pairs) {
      if (typeof(pairs[i]) == 'string') {
        var pair = pairs[i].split('=');
        // Ignore the 'q' path argument, if present.
        if (pair[0] != 'q' && pair[1]) {
          args[decodeURIComponent(pair[0].replace(/\+/g, ' '))] = decodeURIComponent(pair[1].replace(/\+/g, ' '));
        }
      }
    }
    return args;
  };

  /**
 * Helper function to return a view's arguments based on a path.
 */
  Drupal.Views.parseViewArgs = function (href, viewPath) {

    // Provide language prefix.
    if (Drupal.settings.pathPrefix) {
      var viewPath = Drupal.settings.pathPrefix + viewPath;
    }
    var returnObj = {};
    var path = Drupal.Views.getPath(href);
    // Ensure we have a correct path.
    if (viewPath && path.substring(0, viewPath.length + 1) == viewPath + '/') {
      var args = decodeURIComponent(path.substring(viewPath.length + 1, path.length));
      returnObj.view_args = args;
      returnObj.view_path = path;
    }
    return returnObj;
  };

  /**
 * Strip off the protocol plus domain from an href.
 */
  Drupal.Views.pathPortion = function (href) {
    // Remove e.g. http://example.com if present.
    var protocol = window.location.protocol;
    if (href.substring(0, protocol.length) == protocol) {
      // 2 is the length of the '//' that normally follows the protocol.
      href = href.substring(href.indexOf('/', protocol.length + 2));
    }
    return href;
  };

  /**
 * Return the Drupal path portion of an href.
 */
  Drupal.Views.getPath = function (href) {
    href = Drupal.Views.pathPortion(href);
    href = href.substring(Drupal.settings.basePath.length, href.length);
    // 3 is the length of the '?q=' added to the url without clean urls.
    if (href.substring(0, 3) == '?q=') {
      href = href.substring(3, href.length);
    }
    var chars = ['#', '?', '&'];
    for (var i in chars) {
      if (href.indexOf(chars[i]) > -1) {
        href = href.substr(0, href.indexOf(chars[i]));
      }
    }
    return href;
  };

})(jQuery);
;
(function ($) {

/**
 * A progressbar object. Initialized with the given id. Must be inserted into
 * the DOM afterwards through progressBar.element.
 *
 * method is the function which will perform the HTTP request to get the
 * progress bar state. Either "GET" or "POST".
 *
 * e.g. pb = new progressBar('myProgressBar');
 *      some_element.appendChild(pb.element);
 */
Drupal.progressBar = function (id, updateCallback, method, errorCallback) {
  var pb = this;
  this.id = id;
  this.method = method || 'GET';
  this.updateCallback = updateCallback;
  this.errorCallback = errorCallback;

  // The WAI-ARIA setting aria-live="polite" will announce changes after users
  // have completed their current activity and not interrupt the screen reader.
  this.element = $('<div class="progress" aria-live="polite"></div>').attr('id', id);
  this.element.html('<div class="bar"><div class="filled"></div></div>' +
                    '<div class="percentage"></div>' +
                    '<div class="message">&nbsp;</div>');
};

/**
 * Set the percentage and status message for the progressbar.
 */
Drupal.progressBar.prototype.setProgress = function (percentage, message) {
  if (percentage >= 0 && percentage <= 100) {
    $('div.filled', this.element).css('width', percentage + '%');
    $('div.percentage', this.element).html(percentage + '%');
  }
  $('div.message', this.element).html(message);
  if (this.updateCallback) {
    this.updateCallback(percentage, message, this);
  }
};

/**
 * Start monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.startMonitoring = function (uri, delay) {
  this.delay = delay;
  this.uri = uri;
  this.sendPing();
};

/**
 * Stop monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.stopMonitoring = function () {
  clearTimeout(this.timer);
  // This allows monitoring to be stopped from within the callback.
  this.uri = null;
};

/**
 * Request progress data from server.
 */
Drupal.progressBar.prototype.sendPing = function () {
  if (this.timer) {
    clearTimeout(this.timer);
  }
  if (this.uri) {
    var pb = this;
    // When doing a post request, you need non-null data. Otherwise a
    // HTTP 411 or HTTP 406 (with Apache mod_security) error may result.
    $.ajax({
      type: this.method,
      url: this.uri,
      data: '',
      dataType: 'json',
      success: function (progress) {
        // Display errors.
        if (progress.status == 0) {
          pb.displayError(progress.data);
          return;
        }
        // Update display.
        pb.setProgress(progress.percentage, progress.message);
        // Schedule next timer.
        pb.timer = setTimeout(function () { pb.sendPing(); }, pb.delay);
      },
      error: function (xmlhttp) {
        pb.displayError(Drupal.ajaxError(xmlhttp, pb.uri));
      }
    });
  }
};

/**
 * Display errors on the page.
 */
Drupal.progressBar.prototype.displayError = function (string) {
  var error = $('<div class="messages error"></div>').html(string);
  $(this.element).before(error).hide();

  if (this.errorCallback) {
    this.errorCallback(this);
  }
};

})(jQuery);
;
/**
 * @file
 * Handles AJAX fetching of views, including filter submission and response.
 */
(function ($) {

  /**
   * Attaches the AJAX behavior to exposed filter forms and key views links.
   */
  Drupal.behaviors.ViewsAjaxView = {};
  Drupal.behaviors.ViewsAjaxView.attach = function() {
    if (Drupal.settings && Drupal.settings.views && Drupal.settings.views.ajaxViews) {
      $.each(Drupal.settings.views.ajaxViews, function(i, settings) {
        Drupal.views.instances[i] = new Drupal.views.ajaxView(settings);
      });
    }
  };

  Drupal.views = {};
  Drupal.views.instances = {};

  /**
   * JavaScript object for a certain view.
   */
  Drupal.views.ajaxView = function(settings) {
    var selector = '.view-dom-id-' + settings.view_dom_id;
    this.$view = $(selector);

    // Retrieve the path to use for views' ajax.
    var ajax_path = Drupal.settings.views.ajax_path;

    // If there are multiple views this might've ended up showing up multiple
    // times.
    if (ajax_path.constructor.toString().indexOf("Array") != -1) {
      ajax_path = ajax_path[0];
    }

    // Check if there are any GET parameters to send to views.
    var queryString = window.location.search || '';
    if (queryString !== '') {
      // Remove the question mark and Drupal path component if any.
      var queryString = queryString.slice(1).replace(/q=[^&]+&?|&?render=[^&]+/, '');
      if (queryString !== '') {
        // If there is a '?' in ajax_path, clean url are on and & should be
        // used to add parameters.
        queryString = ((/\?/.test(ajax_path)) ? '&' : '?') + queryString;
      }
    }

    this.element_settings = {
      url: ajax_path + queryString,
      submit: settings,
      setClick: true,
      event: 'click',
      selector: selector,
      progress: {
        type: 'throbber'
      }
    };

    this.settings = settings;

    // Add the ajax to exposed forms.
    this.$exposed_form = $('#views-exposed-form-' + settings.view_name.replace(/_/g, '-') + '-' + settings.view_display_id.replace(/_/g, '-'));
    this.$exposed_form.once(jQuery.proxy(this.attachExposedFormAjax, this));

    // Store Drupal.ajax objects here for all pager links.
    this.links = [];

    // Add the ajax to pagers.
    this.$view
      .once(jQuery.proxy(this.attachPagerAjax, this));

    // Add a trigger to update this view specifically. In order to trigger a
    // refresh use the following code.
    //
    // @code
    // jQuery('.view-name').trigger('RefreshView');
    // @endcode
    // Add a trigger to update this view specifically.
    var self_settings = this.element_settings;
    self_settings.event = 'RefreshView';
    this.refreshViewAjax = new Drupal.ajax(this.selector, this.$view, self_settings);
  };

  Drupal.views.ajaxView.prototype.attachExposedFormAjax = function() {
    var button = $('input[type=submit], button[type=submit], input[type=image]', this.$exposed_form);
    button = button[0];

    // Call the autocomplete submit before doing AJAX.
    $(button).click(function () {
      if (Drupal.autocompleteSubmit) {
        Drupal.autocompleteSubmit();
      }
    });

    this.exposedFormAjax = new Drupal.ajax($(button).attr('id'), button, this.element_settings);
  };

  /**
   * Attach the ajax behavior to each link.
   */
  Drupal.views.ajaxView.prototype.attachPagerAjax = function() {
    this.$view.find('ul.pager > li > a, th.views-field a, .attachment .views-summary a')
      .each(jQuery.proxy(this.attachPagerLinkAjax, this));
  };

  /**
   * Attach the ajax behavior to a singe link.
   */
  Drupal.views.ajaxView.prototype.attachPagerLinkAjax = function(id, link) {
    var $link = $(link);
    // Don't attach to pagers inside nested views.
    if ($link.closest('.view')[0] !== this.$view[0]) {
      return;
    }
    var viewData = {};
    var href = $link.attr('href');

    // Provide a default page if none has been set. This must be done
    // prior to merging with settings to avoid accidentally using the
    // page landed on instead of page 1.
    if (typeof(viewData.page) === 'undefined') {
      viewData.page = 0;
    }

    // Construct an object using the settings defaults and then overriding
    // with data specific to the link.
    $.extend(
    viewData,
    this.settings,
    Drupal.Views.parseQueryString(href),
    // Extract argument data from the URL.
    Drupal.Views.parseViewArgs(href, this.settings.view_base_path)
    );

    // For anchor tags, these will go to the target of the anchor rather
    // than the usual location.
    $.extend(viewData, Drupal.Views.parseViewArgs(href, this.settings.view_base_path));

    this.element_settings.submit = viewData;
    this.pagerAjax = new Drupal.ajax(false, $link, this.element_settings);
    this.links.push(this.pagerAjax);
  };

  Drupal.ajax.prototype.commands.viewsScrollTop = function (ajax, response, status) {
    // Scroll to the top of the view. This will allow users
    // to browse newly loaded content after e.g. clicking a pager
    // link.
    var offset = $(response.selector).offset();
    // We can't guarantee that the scrollable object should be
    // the body, as the view could be embedded in something
    // more complex such as a modal popup. Recurse up the DOM
    // and scroll the first element that has a non-zero top.
    var scrollTarget = response.selector;
    while ($(scrollTarget).scrollTop() == 0 && $(scrollTarget).parent()) {
      scrollTarget = $(scrollTarget).parent();
    }
    // Only scroll upward.
    if (offset.top - 10 < $(scrollTarget).scrollTop()) {
      $(scrollTarget).animate({scrollTop: (offset.top - 10)}, 500);
    }
  };

})(jQuery);
;
/*global jQuery, Drupal, window */
/*jslint white:true, multivar, this, browser:true*/

(function($, Drupal, window)
{
	"use strict";

	var popupVisible, ctrlPressed, fancyLoginBox, messageContainer;

	popupVisible = false;
	ctrlPressed = false;

	function moveMessages()
	{
		var messages = $("#fancy_login_login_box .messages");

		if(messages.length)
		{
			if(!messageContainer)
			{
				messageContainer = $("<div/>", {id:"fancy_login_messages_container_wrapper"}).prependTo("body");
			}
			messages.each(function()
			{
				$(this).appendTo(
					$("<div/>", {"class":"fancy_login_messages_container"}).appendTo(messageContainer)
				).before(
					$("<div/>", {"class":"fancy_login_message_close_button"}).text("X")
				);
			});
		}
	}

	function showLogin()
	{
		var settings = Drupal.settings.fancyLogin;

		if(!popupVisible)
		{
			popupVisible = true;
			if(settings.hideObjects)
			{
				$("object, embed").css("visibility", "hidden");
			}

			$("#fancy_login_dim_screen").css({backgroundColor:settings.screenFadeColor, zIndex:settings.screenFadeZIndex, opacity:0, display:"block"}).fadeTo(settings.dimFadeSpeed, 0.8, function()
			{
				var eHeight, eWidth, eTopMargin, eLeftMargin;

				eHeight = fancyLoginBox.height();
				eWidth = fancyLoginBox.width();
				eTopMargin = - 1 * (eHeight / 2);
				eLeftMargin = -1 * (eWidth / 2);

				if($("#fancy_login_close_button").css("display") === "none")
				{
					$("#fancy_login_close_button").css("display", "block");
				}

				fancyLoginBox.css({marginLeft:eLeftMargin, marginTop:eTopMargin, color:settings.loginBoxTextColor, backgroundColor:settings.loginBoxBackgroundColor, borderStyle:settings.loginBoxBorderStyle, borderColor:settings.loginBoxBorderColor, borderWidth:settings.loginBoxBorderWidth, zIndex:(settings.screenFadeZIndex + 1)}).fadeIn(settings.boxFadeSpeed).find(".form-text:first").focus().select();
				$("html, body").css("overflow", "hidden");
			});
		}
	}

	function hideLogin()
	{
		var settings = Drupal.settings.fancyLogin;

		if(popupVisible)
		{
			popupVisible = false;
			$("#fancy_login_login_box").fadeOut(settings.boxFadeSpeed, function()
			{
				$("#fancy_login_dim_screen").fadeOut(settings.dimFadeSpeed, function()
				{
					if(settings.hideObjects)
					{
						$("object, embed").css("visibility", "visible");
					}
				});
				$(window).focus();
				$("html, body").css("overflow", "auto");
			});
		}
	}

	function popupCloseListener()
	{
		$("#fancy_login_dim_screen, #fancy_login_close_button").once("fancy-login-close-listener", function()
		{
			$(this).click(function(e)
			{
				e.preventDefault();

				hideLogin();
			});
		});
	}

	function statusMessageCloseListener()
	{
		$(".fancy_login_message_close_button").once("status-message-close-listener", function()
		{
			$(this).click(function()
			{
				$(this).parent().fadeOut(250, function()
				{
					$(this).remove();
				});
			});
		});
	}

	function loginLinkListener()
	{
		var settings = Drupal.settings.fancyLogin;

		$("a[href*='" + settings.loginPath + "']:not(.fancy_login_disable), .fancy_login_show_popup:not(.fancy_login_disable)").once("login-link-listener", function()
		{
			$(this).click(function(e)
			{
				e.preventDefault();

				showLogin();
			});
		});
	}

	function init()
	{
		$("body").once("fancy-login-init", function()
		{
			fancyLoginBox = $("#fancy_login_login_box");
			$(window.document).keyup(function(e)
			{
				if(e.keyCode === 17)
				{
					ctrlPressed = false;
				}
			    else if(e.keyCode === 27)
			    {
			        hideLogin();
			    }
			});
			$(window.document).keydown(function(e)
			{
				if(e.keyCode === 17)
				{
					ctrlPressed = true;
				}
				if(ctrlPressed === true && e.keyCode === 190)
				{
					ctrlPressed = false;

					if(popupVisible)
					{
						hideLogin();
					}
					else
					{
						showLogin();
					}
				}
			});
		});
	}

	function popupTextfieldListener()
	{
		fancyLoginBox.find(".form-text").once("fancy-login-popup-textfield-listener", function()
		{
			$(this).keydown(function (event)
			{
				if(event.keyCode === 13)
				{
					$(this).parent().siblings(".form-actions:first").children(".form-submit:first").mousedown();
				}
			});
		});
	}

	function loadForm(type)
	{
		var formLoadDimmer = $("<div/>", {"id":"form_load_dimmer"}).appendTo(fancyLoginBox).fadeTo(250, 0.8);

		$.ajax(
		{
			url:Drupal.settings.basePath + "fancy_login/ajax/" + type,
			success:function(data)
			{
				var wrapper, oldContents, newContents, oldHeight, newHeight, newMargin;

				wrapper = fancyLoginBox.find("#fancy_login_user_login_block_wrapper");
				oldContents = wrapper.contents();
				oldHeight = wrapper.css("height");
				newContents =$("<div/>").html(data.content).contents();
				oldContents.replaceWith(newContents);
				newHeight = wrapper.css("height");
				newMargin = fancyLoginBox.outerHeight() / -2;
				newContents.replaceWith(oldContents);
				wrapper.css("height", oldHeight);
				oldContents.fadeOut(250, function()
				{
					$(this).remove();
					fancyLoginBox.animate(
					{
						marginTop:newMargin
					},
					{
						duration:250
					});
					wrapper.animate(
					{
						height:newHeight
					},
					{
						duration:250,
						complete:function()
						{
							newContents.appendTo(wrapper).fadeIn(250, function()
							{
								wrapper.css("height", "auto");
								formLoadDimmer.fadeOut(250, function()
								{
									$(this).remove();
								});
							});
							Drupal.attachBehaviors();
						}
					});
				});
			}
		});
	}

	function linkListeners()
	{
		var anchors = fancyLoginBox.find("a");

		if(!Drupal.settings.fancyLogin.disableRegistration)
		{
			anchors.filter("[href*='user/register']").once("fancy-login-register-link", function()
			{
				$(this).click(function(e)
				{
					e.preventDefault();
					loadForm("register");
				});
			});
		}

		anchors.filter("[href*='user/password']").once("fancy-login-password-link", function()
		{
			$(this).click(function(e)
			{
				e.preventDefault();
				loadForm("password");
			});
		});

		anchors.filter("[href*='user/login']").once("fancy-login-login-link", function()
		{
			$(this).click(function(e)
			{
				e.preventDefault();
				loadForm("login");
			});
		});
	}

	Drupal.behaviors.fancyLogin = {
		attach:function()
		{
			if(window.XMLHttpRequest)
			{
				init();
				loginLinkListener();
				popupTextfieldListener();
				popupCloseListener();
				statusMessageCloseListener();
				moveMessages();
				linkListeners();
			}

			Drupal.ajax.prototype.commands.fancyLoginRefreshPage = function(ajax, response)
			{
				// For JSLint compatibility
				ajax = ajax;

				if(response.closePopup)
				{
					hideLogin();
				}

				window.location.reload();
			};

			Drupal.ajax.prototype.commands.fancyLoginRedirect = function(ajax, response)
			{
				// For JSLint compatibility
				ajax = ajax;

				if(response.closePopup)
				{
					hideLogin();
				}

				if(response.destination.length)
				{
					window.location = response.destination;
				}
				else
				{
					window.location = "user";
				}
			};

			Drupal.ajax.prototype.commands.fancyLoginClosePopup = function()
			{
				hideLogin();
			};
		}
	};
}(jQuery, Drupal, window));
;
