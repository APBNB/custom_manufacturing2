// Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.provide("frappe.ui.form.handlers");
frappe.ui.form.handlers["Job Card"] = {};

if (window.cur_frm && cur_frm.doctype === "Job Card") {
	cur_frm.events = {};
}

const GLR_TIME_FIELDS = [
	"custom_from",
	"custom_to",
	"custom_from_time",
	"custom_to_time",
	"custom_from_time3",
	"custom_to_time3",
	"custom_from_time5",
	"custom_to_time_5",
	"custom_from_time_7",
	"custom_to_time_7",
	"custom_from_time9",
	"custom_to_time9",
	"custom_from_time11",
	"custom_to_time11_",
	"custom_from_time14",
	"custom_to_time14",
];

// Mapping of from-to fields to their duration fields
const GLR_DURATION_MAPPINGS = [
	{ from: "custom_from", to: "custom_to", duration: "custom_duration" },
	{ from: "custom_from_time", to: "custom_to_time", duration: "custom_duration2" },
	{ from: "custom_from_time_7", to: "custom_to_time_7", duration: "custom_duration3" },
	{ from: "custom_from_time9", to: "custom_to_time9", duration: "custom_duration4" },
	{ from: "custom_from_time11", to: "custom_to_time11_", duration: "custom_duration5" },
	{ from: "custom_from_time14", to: "custom_to_time14", duration: "custom_duration7" },
];

const set_next_glr_time = (frm) => {
	if (!frm) {
		return;
	}

	if (frm.doc.docstatus !== 0) {
		frappe.msgprint({
			message: __("You can only record times while the Job Card is in Draft."),
			indicator: "orange",
		});
		return;
	}

	const fieldname = GLR_TIME_FIELDS.find((name) => !frm.doc[name]);

	if (!fieldname) {
		frappe.msgprint({
			message: __("All GLR time fields already have values."),
			indicator: "green",
		});
		return;
	}

	const now = frappe.datetime.now_time();

	frm.set_value(fieldname, now).then(() => {
		const docfield = frappe.meta.get_docfield(frm.doctype, fieldname, frm.docname);
		const label = docfield?.label || frappe.model.unscrub(fieldname);

		frappe.show_alert({
			message: __("Recorded {0} as {1}", [__(label), now]),
			indicator: "green",
		});

		// After setting the time, check if we need to calculate duration
		GLR_DURATION_MAPPINGS.forEach((mapping, index) => {
			if (mapping.from === fieldname || mapping.to === fieldname) {
				// Small delay to ensure the value is set
				setTimeout(() => {
					calculate_glr_duration(frm, mapping);
				}, 100);
			}
		});
	});
};

const style_glr_record_button = (frm) => {
	const field = frm.fields_dict?.custom_record_time;

	if (!field?.$wrapper || !field.$input) {
		return;
	}

	if (!field.$wrapper.hasClass("glr-record-styled")) {
		const inputWrapper = field.$wrapper.find(".control-input-wrapper");

		inputWrapper.css({
			display: "flex",
			"justify-content": "flex-end",
		});

		field.$input
			.removeClass("btn-default")
			.addClass("btn-glr-record")
			.css({
				"background-color": "#000",
				color: "#fff",
				"font-weight": "700",
				border: "1px solid #000",
			});

		field.$wrapper.addClass("glr-record-styled");
	}
};

// Helper function to add minutes to time string (HH:MM or HH:MM:SS)
const add_minutes_to_time = (time_str, minutes) => {
	if (!time_str) return null;
	
	// Parse the time string
	const today = moment().format("YYYY-MM-DD");
	const datetime = moment(`${today} ${time_str}`, "YYYY-MM-DD HH:mm:ss");
	
	if (!datetime.isValid()) {
		return null;
	}
	
	// Add minutes
	datetime.add(minutes, 'minutes');
	
	// Return in HH:mm format
	return datetime.format("HH:mm");
};

// Function to populate recording time fields with intervals
const populate_recording_times = (frm, interval_minutes = 20) => {
	const base_time = frm.doc.custom_recording_time;
	
	if (!base_time) {
		return;
	}
	
	const time_fields = [
		'custom_recording_time1',
		'custom_recording_time2',
		'custom_recording_time3',
		'custom_recording_time4',
		'custom_recording_time5',
		'custom_recording_time6',
		'custom_recording_time7',
		'custom_recording_time8'
	];
	
	time_fields.forEach((field, index) => {
		const minutes_to_add = (index + 1) * interval_minutes;
		const new_time = add_minutes_to_time(base_time, minutes_to_add);
		
		if (new_time) {
			frm.set_value(field, new_time);
		}
	});
	
	frappe.show_alert({
		message: __('Recording times populated with {0} minute intervals', [interval_minutes]),
		indicator: 'green'
	});
};

const calculate_glr_duration = (frm, mapping) => {
	const from_time = frm.doc[mapping.from];
	const to_time = frm.doc[mapping.to];
	
	if (from_time && to_time) {
		const duration = get_minutes_diff(from_time, to_time);
		frm.set_value(mapping.duration, duration);
	}
};

const calculate_all_glr_durations = (frm) => {
	GLR_DURATION_MAPPINGS.forEach((mapping, index) => {
		calculate_glr_duration(frm, mapping);
	});
};

frappe.ui.form.on("Job Card", {
	setup: function (frm) {
		frm.set_query("operation", function () {
			return {
				query: "erpnext.manufacturing.doctype.job_card.job_card.get_operations",
				filters: {
					work_order: frm.doc.work_order,
				},
			};
		});

		frm.set_query("serial_and_batch_bundle", () => {
			return {
				filters: {
					item_code: frm.doc.production_item,
					voucher_type: frm.doc.doctype,
					voucher_no: ["in", [frm.doc.name, ""]],
					is_cancelled: 0,
				},
			};
		});

		frm.set_query("item_code", "scrap_items", () => {
			return {
				filters: {
					disabled: 0,
				},
			};
		});

		frm.set_indicator_formatter("sub_operation", function (doc) {
			if (doc.status == "Pending") {
				return "red";
			} else {
				return doc.status === "Complete" ? "green" : "orange";
			}
		});
	},

	refresh: function (frm) {
		frappe.flags.pause_job = 0;
		frappe.flags.resume_job = 0;
		let has_items = frm.doc.items && frm.doc.items.length;

		if (!frm.is_new() && frm.doc.__onload?.work_order_closed) {
			frm.disable_save();
			return;
		}

		let has_stock_entry = frm.doc.__onload && frm.doc.__onload.has_stock_entry ? true : false;

		frm.toggle_enable("for_quantity", !has_stock_entry);

		if (!frm.is_new() && has_items && frm.doc.docstatus < 2) {
			let to_request = frm.doc.for_quantity > frm.doc.transferred_qty;
			let excess_transfer_allowed = frm.doc.__onload.job_card_excess_transfer;

			if (to_request || excess_transfer_allowed) {
				frm.add_custom_button(
					__("Material Request"),
					() => {
						frm.trigger("make_material_request");
					},
					__("Create")
				);
			}

			// check if any row has untransferred materials
			// in case of multiple items in JC
			let to_transfer = frm.doc.items.some((row) => row.transferred_qty < row.required_qty);

			if (to_transfer || excess_transfer_allowed) {
				frm.add_custom_button(
					__("Material Transfer"),
					() => {
						frm.trigger("make_stock_entry");
					},
					__("Create")
				);
			}
		}

		if (frm.doc.docstatus == 1 && !frm.doc.is_corrective_job_card) {
			frm.trigger("setup_corrective_job_card");
		}

		frm.set_query("quality_inspection", function () {
			return {
				query: "erpnext.stock.doctype.quality_inspection.quality_inspection.quality_inspection_query",
				filters: {
					item_code: frm.doc.production_item,
					reference_name: frm.doc.name,
				},
			};
		});

		frm.trigger("toggle_operation_number");

		if (
			frm.doc.docstatus == 0 &&
			!frm.is_new() &&
			(frm.doc.for_quantity > frm.doc.total_completed_qty || !frm.doc.for_quantity) &&
			(frm.doc.items || !frm.doc.items.length || frm.doc.for_quantity == frm.doc.transferred_qty)
		) {
			// if Job Card is link to Work Order, the job card must not be able to start if Work Order not "Started"
			// and if stock mvt for WIP is required
			if (frm.doc.work_order) {
				frappe.db.get_value(
					"Work Order",
					frm.doc.work_order,
					["skip_transfer", "status"],
					(result) => {
						if (
							result.skip_transfer === 1 ||
							result.status == "In Process" ||
							frm.doc.transferred_qty > 0 ||
							!frm.doc.items.length
						) {
							frm.trigger("prepare_timer_buttons");
						}
					}
				);
			} else {
				frm.trigger("prepare_timer_buttons");
			}
		}

		frm.trigger("setup_quality_inspection");

		if (frm.doc.work_order) {
			frappe.db.get_value("Work Order", frm.doc.work_order, "transfer_material_against").then((r) => {
				if (r.message.transfer_material_against == "Work Order") {
					frm.set_df_property("items", "hidden", 1);
				}
			});
		}

		let sbb_field = frm.get_docfield("serial_and_batch_bundle");
		if (sbb_field) {
			sbb_field.get_route_options_for_new_doc = () => {
				return {
					item_code: frm.doc.production_item,
					warehouse: frm.doc.wip_warehouse,
					voucher_type: frm.doc.doctype,
				};
			};
		}

		style_glr_record_button(frm);
	},

	onload_post_render: function (frm) {
		style_glr_record_button(frm);
	},

	custom_record_time: function (frm) {
		set_next_glr_time(frm);
	},

	custom_recording_time: function (frm) {
		populate_recording_times(frm, 20);
	},

	setup_quality_inspection: function (frm) {
		let quality_inspection_field = frm.get_docfield("quality_inspection");
		quality_inspection_field.get_route_options_for_new_doc = function (frm) {
			return {
				inspection_type: "In Process",
				reference_type: "Job Card",
				reference_name: frm.doc.name,
				item_code: frm.doc.production_item,
				item_name: frm.doc.item_name,
				item_serial_no: frm.doc.serial_no,
				batch_no: frm.doc.batch_no,
				quality_inspection_template: frm.doc.quality_inspection_template,
			};
		};
	},

	setup_corrective_job_card: function (frm) {
		frm.add_custom_button(
			__("Corrective Job Card"),
			() => {
				let operations = frm.doc.sub_operations.map((d) => d.sub_operation).concat(frm.doc.operation);

				let fields = [
					{
						fieldtype: "Link",
						label: __("Corrective Operation"),
						options: "Operation",
						fieldname: "operation",
						get_query() {
							return {
								filters: {
									is_corrective_operation: 1,
								},
							};
						},
					},
					{
						fieldtype: "Link",
						label: __("For Operation"),
						options: "Operation",
						fieldname: "for_operation",
						get_query() {
							return {
								filters: {
									name: ["in", operations],
								},
							};
						},
					},
				];

				frappe.prompt(
					fields,
					(d) => {
						frm.events.make_corrective_job_card(frm, d.operation, d.for_operation);
					},
					__("Select Corrective Operation")
				);
			},
			__("Make")
		);
	},

	make_corrective_job_card: function (frm, operation, for_operation) {
		frappe.call({
			method: "erpnext.manufacturing.doctype.job_card.job_card.make_corrective_job_card",
			args: {
				source_name: frm.doc.name,
				operation: operation,
				for_operation: for_operation,
			},
			callback: function (r) {
				if (r.message) {
					frappe.model.sync(r.message);
					frappe.set_route("Form", r.message.doctype, r.message.name);
				}
			},
		});
	},

	operation: function (frm) {
		frm.trigger("toggle_operation_number");

		if (frm.doc.operation && frm.doc.work_order) {
			frappe.call({
				method: "erpnext.manufacturing.doctype.job_card.job_card.get_operation_details",
				args: {
					work_order: frm.doc.work_order,
					operation: frm.doc.operation,
				},
				callback: function (r) {
					if (r.message) {
						if (r.message.length == 1) {
							frm.set_value("operation_id", r.message[0].name);
						} else {
							let args = [];

							r.message.forEach((row) => {
								args.push({ label: row.idx, value: row.name });
							});

							let description = __("Operation {0} added multiple times in the work order {1}", [
								frm.doc.operation,
								frm.doc.work_order,
							]);

							frm.set_df_property("operation_row_number", "options", args);
							frm.set_df_property("operation_row_number", "description", description);
						}

						frm.trigger("toggle_operation_number");
					}
				},
			});
		}
	},

	operation_row_number(frm) {
		if (frm.doc.operation_row_number) {
			frm.set_value("operation_id", frm.doc.operation_row_number);
		}
	},

	toggle_operation_number(frm) {
		frm.toggle_display("operation_row_number", !frm.doc.operation_id && frm.doc.operation);
		frm.toggle_reqd("operation_row_number", !frm.doc.operation_id && frm.doc.operation);
	},

	prepare_timer_buttons: function (frm) {
		frm.trigger("make_dashboard");

		if (!frm.doc.started_time && !frm.doc.current_time) {
			frm.add_custom_button(__("Start Job"), () => {
				if ((frm.doc.employee && !frm.doc.employee.length) || !frm.doc.employee) {
					frappe.prompt(
						{
							fieldtype: "Table MultiSelect",
							label: __("Select Employees"),
							options: "Job Card Time Log",
							fieldname: "employees",
						},
						(d) => {
							frm.events.start_job(frm, "Work In Progress", d.employees);
						},
						__("Assign Job to Employee")
					);
				} else {
					frm.events.start_job(frm, "Work In Progress", frm.doc.employee);
				}
			}).addClass("btn-primary");
		} else if (frm.doc.status == "On Hold") {
			frm.add_custom_button(__("Resume Job"), () => {
				frm.events.start_job(frm, "Resume Job", frm.doc.employee);
			}).addClass("btn-primary");
		} else {
			frm.add_custom_button(__("Pause Job"), () => {
				frm.events.complete_job(frm, "On Hold");
			});

			frm.add_custom_button(__("Complete Job"), () => {
				var sub_operations = frm.doc.sub_operations;

				let set_qty = true;
				if (sub_operations && sub_operations.length > 1) {
					set_qty = false;
					let last_op_row = sub_operations[sub_operations.length - 2];

					if (last_op_row.status == "Complete") {
						set_qty = true;
					}
				}

				if (set_qty) {
					frappe.prompt(
						{
							fieldtype: "Float",
							label: __("Completed Quantity"),
							fieldname: "qty",
							default: frm.doc.for_quantity - frm.doc.total_completed_qty,
						},
						(data) => {
							frm.events.complete_job(frm, "Complete", data.qty);
						},
						__("Enter Value")
					);
				} else {
					frm.events.complete_job(frm, "Complete", 0.0);
				}
			}).addClass("btn-primary");
		}
	},

	start_job: function (frm, status, employee) {
		const args = {
			job_card_id: frm.doc.name,
			start_time: frappe.datetime.now_datetime(),
			employees: employee,
			status: status,
		};
		frm.events.make_time_log(frm, args);
	},

	complete_job: function (frm, status, completed_qty) {
		const args = {
			job_card_id: frm.doc.name,
			complete_time: frappe.datetime.now_datetime(),
			status: status,
			completed_qty: completed_qty,
		};
		frm.events.make_time_log(frm, args);
	},

	make_time_log: function (frm, args) {
		frm.events.update_sub_operation(frm, args);

		frappe.call({
			method: "erpnext.manufacturing.doctype.job_card.job_card.make_time_log",
			args: {
				args: args,
			},
			freeze: true,
			callback: function () {
				frm.reload_doc();
				frm.trigger("make_dashboard");
			},
		});
	},

	update_sub_operation: function (frm, args) {
		if (frm.doc.sub_operations && frm.doc.sub_operations.length) {
			let sub_operations = frm.doc.sub_operations.filter((d) => d.status != "Complete");
			if (sub_operations && sub_operations.length) {
				args["sub_operation"] = sub_operations[0].sub_operation;
			}
		}
	},

	validate: function (frm) {
		if ((!frm.doc.time_logs || !frm.doc.time_logs.length) && frm.doc.started_time) {
			frm.trigger("reset_timer");
		}

		calculate_all_glr_durations(frm);
	},

	reset_timer: function (frm) {
		frm.set_value("started_time", "");
	},

	make_dashboard: function (frm) {
		if (frm.doc.__islocal) return;

		function setCurrentIncrement() {
			currentIncrement += 1;
			return currentIncrement;
		}

		function updateStopwatch(increment) {
			var hours = Math.floor(increment / 3600);
			var minutes = Math.floor((increment - hours * 3600) / 60);
			var seconds = Math.floor(increment - hours * 3600 - minutes * 60);

			$(section)
				.find(".hours")
				.text(hours < 10 ? "0" + hours.toString() : hours.toString());
			$(section)
				.find(".minutes")
				.text(minutes < 10 ? "0" + minutes.toString() : minutes.toString());
			$(section)
				.find(".seconds")
				.text(seconds < 10 ? "0" + seconds.toString() : seconds.toString());
		}

		function initialiseTimer() {
			const interval = setInterval(function () {
				var current = setCurrentIncrement();
				updateStopwatch(current);
			}, 1000);
		}

		frm.dashboard.refresh();
		const timer = `
			<div class="stopwatch" style="font-weight:bold;margin:0px 13px 0px 2px;
				color:#545454;font-size:18px;display:inline-block;vertical-align:text-bottom;">
				<span class="hours">00</span>
				<span class="colon">:</span>
				<span class="minutes">00</span>
				<span class="colon">:</span>
				<span class="seconds">00</span>
			</div>`;

		var section = frm.toolbar.page.add_inner_message(timer);

		let currentIncrement = frm.events.get_current_time(frm);
		if (frm.doc.started_time || frm.doc.current_time) {
			if (frm.doc.status == "On Hold") {
				updateStopwatch(currentIncrement);
			} else {
				initialiseTimer();
			}
		}
	},

	get_current_time(frm) {
		let current_time = 0;

		frm.doc.time_logs.forEach((d) => {
			if (d.to_time) {
				if (d.time_in_mins) {
					current_time += flt(d.time_in_mins, 2) * 60;
				} else {
					current_time += get_seconds_diff(d.to_time, d.from_time);
				}
			} else {
				current_time += get_seconds_diff(frappe.datetime.now_datetime(), d.from_time);
			}
		});

		return current_time;
	},

	hide_timer: function (frm) {
		frm.toolbar.page.inner_toolbar.find(".stopwatch").remove();
	},

	for_quantity: function (frm) {
		frm.doc.items = [];
		frm.call({
			method: "get_required_items",
			doc: frm.doc,
			callback: function () {
				refresh_field("items");
			},
		});
	},

	make_material_request: function (frm) {
		frappe.model.open_mapped_doc({
			method: "erpnext.manufacturing.doctype.job_card.job_card.make_material_request",
			frm: frm,
			run_link_triggers: true,
		});
	},

	make_stock_entry: function (frm) {
		frappe.model.open_mapped_doc({
			method: "erpnext.manufacturing.doctype.job_card.job_card.make_stock_entry",
			frm: frm,
			run_link_triggers: true,
		});
	},

	timer: function (frm) {
		return `<button> Start </button>`;
	},

	set_total_completed_qty: function (frm) {
		frm.doc.total_completed_qty = 0;
		frm.doc.time_logs.forEach((d) => {
			if (d.completed_qty) {
				frm.doc.total_completed_qty += d.completed_qty;
			}
		});

		if (frm.doc.total_completed_qty && frm.doc.for_quantity > frm.doc.total_completed_qty) {
			let flt_precision = precision("for_quantity", frm.doc);
			let process_loss_qty =
				flt(frm.doc.for_quantity, flt_precision) - flt(frm.doc.total_completed_qty, flt_precision);

			frm.set_value("process_loss_qty", process_loss_qty);
		}

		refresh_field("total_completed_qty");
	},

	custom_from: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[0]);
	},
	custom_to: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[0]);
	},
	custom_from_time: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[1]);
	},
	custom_to_time: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[1]);
	},
	custom_from_time_7: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[2]);
	},
	custom_to_time_7: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[2]);
	},
	custom_from_time9: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[3]);
	},
	custom_to_time9: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[3]);
	},
	custom_from_time11: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[4]);
	},
	custom_to_time11_: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[4]);
	},
	custom_from_time14: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[5]);
	},
	custom_to_time14: function(frm) {
		calculate_glr_duration(frm, GLR_DURATION_MAPPINGS[5]);
	},
});

frappe.ui.form.on("Job Card Time Log", {
	completed_qty: function (frm) {
		frm.events.set_total_completed_qty(frm);
	},

	to_time: function (frm) {
		frm.set_value("started_time", "");
	},
});

function get_seconds_diff(d1, d2) {
	return moment(d1).diff(d2, "seconds");
}

function get_minutes_diff(time1, time2) {
	if (!time1 || !time2) {
		return 0;
	}

	const today = moment().format("YYYY-MM-DD");
	const datetime1 = moment(`${today} ${time1}`, "YYYY-MM-DD HH:mm:ss");
	const datetime2 = moment(`${today} ${time2}`, "YYYY-MM-DD HH:mm:ss");
	const diff = Math.abs(datetime1.diff(datetime2, "minutes"));
	return diff;
}


let weight_fields = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
let handlers = {};

weight_fields.forEach(field => {
	handlers[field] = function(frm, cdt, cdn) {
		calculate_total_weight(frm, cdt, cdn);
	};
});

frappe.ui.form.on("LotNo x Bag No", handlers);

function calculate_total_weight(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	let weight_columns = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
	
	weight_columns.forEach(col => {
		let value = row[col] || 0;
		if (value > 150) {
			frappe.msgprint({
				title: __('Invalid Value'),
				indicator: 'red',
				message: __('Row {0}, Column {1}: Maximum allowed value is 150. Value entered: {2}', [row.idx, col, value])
			});
			frappe.model.set_value(cdt, cdn, col, 150);
		}
	});
	
	let total = weight_columns.reduce((sum, col) => sum + (row[col] || 0), 0);
	
	frappe.model.set_value(cdt, cdn, 'total', total);
	
	if (total > 1000) {
		frappe.msgprint({
			title: __('Warning'),
			indicator: 'red',
			message: __('Row {0}: Total weight ({1}) exceeds 1000!', [row.idx, total])
		});
	}
}