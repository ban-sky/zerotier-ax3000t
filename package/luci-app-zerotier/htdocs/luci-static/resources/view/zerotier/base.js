/* SPDX-License-Identifier: Apache-2.0
 *
 * LuCI configuration page for ZeroTier 1.16.x
 *
 * The UCI layout is the one used by the upstream OpenWrt package:
 *   config zerotier 'global'
 *   config network 'earth'
 *       option id '8056c2e21c000001'
 */

'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('zerotier'), {}).then(function(res) {
		try {
			return res.zerotier.instances.instance1.running === true;
		}
		catch (e) {
			return false;
		}
	});
}

function renderStatus(isRunning) {
	return E('em', {}, [
		E('span', { style: 'color:' + (isRunning ? 'green' : 'red') }, [
			E('strong', {}, _('ZeroTier') + ' ' + (isRunning ? _('RUNNING') : _('NOT RUNNING')))
		])
	]);
}

return view.extend({
	load: function() {
		return uci.load('zerotier');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('zerotier', _('ZeroTier'),
			_('ZeroTier is an open source, cross-platform and easy to use virtual LAN. ' +
			  'Enable the service and add the IDs of the networks you want to join.'));

		/* Live service state. */
		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function() {
			poll.add(function() {
				return getServiceStatus().then(function(running) {
					var el = document.getElementById('zerotier_status');
					if (!el)
						return;

					while (el.firstChild)
						el.removeChild(el.firstChild);

					el.appendChild(renderStatus(running));
				});
			}, 5);

			return E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Status')),
				E('p', { id: 'zerotier_status' }, _('Collecting data ...'))
			]);
		};

		/* Global settings: config zerotier 'global' */
		s = m.section(form.NamedSection, 'global', 'zerotier', _('Global Settings'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable'),
			_('Start the ZeroTier service at boot and when settings are applied.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Listening port'),
			_('UDP port used by ZeroTier. Leave empty for the default (9993), use 0 for a random port.'));
		o.placeholder = '9993';
		o.rmempty = true;
		o.validate = function(section_id, value) {
			if (value == null || value === '')
				return true;

			var port = parseInt(value, 10);
			if (isNaN(port) || port < 0 || port > 65535)
				return _('Invalid port number.');

			return true;
		};

		o = s.option(form.Button, '_central', _('ZeroTier Central'),
			_('Create or manage a network and authorize the clients that may join it.'));
		o.inputtitle = _('Open website');
		o.inputstyle = 'apply';
		o.onclick = function() {
			window.open('https://my.zerotier.com/network', '_blank');
		};

		/* Joined networks: config network '<name>' */
		s = m.section(form.TypedSection, 'network', _('Networks'),
			_('Each entry joins one ZeroTier network. The network ID is a 16 character hexadecimal string.'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add network');

		o = s.option(form.Value, 'id', _('Network ID'));
		o.placeholder = '8056c2e21c000001';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (!/^[0-9a-fA-F]{16}$/.test(value || ''))
				return _('The network ID must be exactly 16 hexadecimal characters.');

			return true;
		};

		o = s.option(form.Flag, 'allow_managed', _('Allow managed'),
			_('Accept IP addresses, routes and other settings pushed by the network controller.'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.option(form.Flag, 'allow_global', _('Allow global'),
			_('Allow the network to assign globally routable IP addresses.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Flag, 'allow_default', _('Allow default route'),
			_('Allow the network to become the default route. This can interrupt your internet access.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Flag, 'allow_dns', _('Allow DNS'),
			_('Allow the network to set DNS servers. This can override the DNS servers of this router.'));
		o.default = o.disabled;
		o.rmempty = false;

		return m.render();
	}
});
