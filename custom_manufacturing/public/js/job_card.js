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
const GLR_DURATION_MAPPINGS = [
	{ from: "custom_from", to: "custom_to", duration: "custom_duration" },
	{ from: "custom_from_time", to: "custom_to_time", duration: "custom_duration2" },
	{ from: "custom_from_time_7", to: "custom_to_time_7", duration: "custom_duration3" },
	{ from: "custom_from_time9", to: "custom_to_time9", duration: "custom_duration4" },
	{ from: "custom_from_time11", to: "custom_to_time11_", duration: "custom_duration5" },
	{ from: "custom_from_time14", to: "custom_to_time14", duration: "custom_duration7" },
];
const GLR_TIME_FIELDS_ANF = [
    "custom_from_time_anf1",
    "custom_to_time1",
    "custom_from_time_anf",
    "custom_to_time_anf",
];
const GLR_DURATION_MAPPINGS_ANF = [
	{ from: "custom_from_time_anf1", to: "custom_to_time1", duration: "custom_duration_anf9" },
    { from: "custom_from_time_anf", to: "custom_to_time_anf", duration: "custom_duration_anf" },
];

const is_field_visible = (frm, fieldname) => {
    const field = frm.get_field(fieldname);
    return !!(field && $(field.wrapper).is(":visible"));
};
const set_next_glr_time = (frm, glr_field_list = [], duration_list = []) => {
    if (!frm) return;

    if (frm.doc.docstatus !== 0) {
        frappe.msgprint({
            message: __("You can only record times while the Job Card is in Draft."),
            indicator: "orange",
        });
        return;
    }
    const next_anf_field = GLR_TIME_FIELDS_ANF.find(f => !frm.doc[f]);

    if (next_anf_field) {
        const now = frappe.datetime.now_time();

        frm.set_value(next_anf_field, now).then(() => {
            const label = frappe.meta.get_docfield(frm.doctype, next_anf_field)?.label || frappe.model.unscrub(next_anf_field);

            frappe.show_alert({
                message: __("Recorded {0} as {1}", [__(label), now]),
                indicator: "green",
            });
            GLR_DURATION_MAPPINGS_ANF.forEach(mapping => {
                if (mapping.from === next_anf_field || mapping.to === next_anf_field) {
                    setTimeout(() => calculate_glr_duration(frm, mapping), 100);
                }
            });
        });

        return; 
    }
    const next_glr_field = glr_field_list.find(f => !frm.doc[f]);

    if (next_glr_field) {
        if (!is_field_visible(frm, next_glr_field)) {
            frappe.msgprint({
                message: __("First fill the required fields before {0}.", [__(next_glr_field)]),
                indicator: "pink",
            });
            return;
        }
        const now = frappe.datetime.now_time();
        frm.set_value(next_glr_field, now).then(() => {
            const label = frappe.meta.get_docfield(frm.doctype, next_glr_field)?.label || frappe.model.unscrub(next_glr_field);

            frappe.show_alert({
                message: __("Recorded {0} as {1}", [__(label), now]),
                indicator: "green",
            });
            (duration_list || []).forEach((mapping) => {
                if (mapping.from === next_glr_field || mapping.to === next_glr_field) {
                    setTimeout(() => calculate_glr_duration(frm, mapping), 100);
                }
            });
        });
        return;
    }

    handle_washing_time_record(frm);
};
const style_glr_record_button = (frm, fieldname) => {
    const field = frm.fields_dict?.[fieldname];

    if (!field?.$wrapper || !field.$input) return;

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

const calculate_glr_duration = (frm, mapping) => {
	const from_time = frm.doc[mapping.from];
	const to_time = frm.doc[mapping.to];
	
	if (from_time && to_time) {
		const duration = get_minutes_diff(from_time, to_time);
		frm.set_value(mapping.duration, duration);
	}
};
const find_duration_mapping = (fieldname, mapping_list) => {
	return mapping_list.find(
		(mapping) => mapping.from === fieldname || mapping.to === fieldname
	);
};

const register_duration_handlers = (field_list, mapping_list) => {
	field_list.forEach((fieldname) => {
		const mapping = find_duration_mapping(fieldname, mapping_list);
		if (mapping) {
			frappe.ui.form.on("Job Card", {
				[fieldname]: function(frm) {
					calculate_glr_duration(frm, mapping);
				}
			});
		}
	});
};
register_duration_handlers(GLR_TIME_FIELDS, GLR_DURATION_MAPPINGS);
const calculate_all_glr_durations = (frm) => {
	GLR_DURATION_MAPPINGS.forEach((mapping, index) => {
		calculate_glr_duration(frm, mapping);
	});
};

// cutting weigth lot
let skipped_blocks = [];
function fill_next_weight_block(frm) {
    let child_table_fieldname = 'custom_weight_per_bag';

    if (!frm.doc[child_table_fieldname] || frm.doc[child_table_fieldname].length === 0) {
        frappe.msgprint({
            title: __('No Rows'),
            indicator: 'red',
            message: __('Please add at least one row in the LotNo x Bag No table first.')
        });
        return;
    }
    let weight_columns = ['1','2','3','4','5','6','7','8','9'];

    for (let row of frm.doc[child_table_fieldname]) {
        for (let col of weight_columns) {

            if (skipped_blocks.some(b => b.rowname === row.name && b.col === col)) {
                continue;  
            }

            if (!row[col] || row[col] === 0) {
                frappe.model.set_value(row.doctype, row.name, col, 150);
                frappe.show_alert({
                    message: __("Filled Row {0}, Column {1} with 150", [row.idx, col]),
                    indicator: "green"
                });
                return;
            }
        }
    }

    frappe.msgprint({
        title: __('All Blocks Filled'),
        indicator: 'blue',
        message: __('All weight blocks are filled or skipped.')
    });
}
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

	refresh: function(frm) {
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
	},
	onload_post_render: function (frm) {
		style_glr_record_button(frm, "custom_record_time");
		style_glr_record_button(frm, "custom_record_time_");
		style_glr_record_button(frm, "custom_record");
		style_glr_record_button(frm, "custom_record_time_h");
		style_glr_record_button(frm, "custom_record_");
		style_glr_record_button(frm, "custom_record_time_a");

	},

	custom_record_time(frm) {
    set_next_glr_time(frm, GLR_TIME_FIELDS, GLR_DURATION_MAPPINGS);
},
custom_record_time_h(frm) {
        handle_homogenization_time_record(frm);
    },

custom_record_time_(frm) {
    set_next_glr_time(frm, GLR_TIME_FIELDS_ANF, GLR_DURATION_MAPPINGS_ANF);
},

	custom_fill_weigth: function(frm) {
	fill_next_weight_block(frm);
},
custom_skip: function(frm) {
    let child_table_fieldname = 'custom_weight_per_bag';
    let weight_columns = ['1','2','3','4','5','6','7','8','9'];

    outer:
    for (let row of frm.doc[child_table_fieldname] || []) {
        for (let col of weight_columns) {
            if ((!row[col] || row[col] === 0) && 
                !skipped_blocks.some(b => b.rowname === row.name && b.col === col)) 
            {
                skipped_blocks.push({ rowname: row.name, col: col });
                frappe.show_alert({
                    message: __("Skipped Row {0} Col {1}", [row.idx, col]),
                    indicator: "orange"
                });
                break outer;
            }
        }
    }
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
	
	custom_acid_solution_ampere_a: function(frm) {
        calculate_ampere_difference(frm);
    },
    custom_note_ampereb: function(frm) {
        calculate_ampere_difference(frm);
    }
});
function calculate_ampere_difference(frm) {
    let a = frm.doc.custom_acid_solution_ampere_a || 0;
    let b = frm.doc.custom_note_ampereb || 0;

    if (a && b) {
        frm.set_value("custom_note_ampere_difference_ba", (b - a).toFixed(2));
    } else {
        frm.set_value("custom_note_ampere_difference_ba", null);
    }
}
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
    let changed_column = null;
    
    weight_columns.forEach(col => {
        let value = row[col] || 0;
        if (value > 150) {
            frappe.msgprint({
                title: __('Invalid Value'),
                indicator: 'red',
                message: __('Row {0}, Column {1}: Maximum allowed value is 150. Value entered: {2}', [row.idx, col, value])
            });
            frappe.model.set_value(cdt, cdn, col, 150);
            changed_column = col;
        }
    });
    
    let total = weight_columns.reduce((sum, col) => sum + (row[col] || 0), 0);
    
    if (total > 1000) {
        let excess = total - 1000;
        
        if (!changed_column) {
            for (let i = weight_columns.length - 1; i >= 0; i--) {
                if (row[weight_columns[i]] > 0) {
                    changed_column = weight_columns[i];
                    break;
                }
            }
        }
        
        if (changed_column) {
            let current_value = row[changed_column] || 0;
            let new_value = Math.max(0, current_value - excess);
            
            frappe.msgprint({
                title: __('Total Limit Reached'),
                indicator: 'orange',
                message: __('Row {0}: Total cannot exceed 1000. Column {1} adjusted from {2} to {3}', 
                    [row.idx, changed_column, current_value, new_value])
            });
            
            frappe.model.set_value(cdt, cdn, changed_column, new_value);
            total = 1000; 
        }
    }
    
    frappe.model.set_value(cdt, cdn, 'total', total);
}

// from and to time data recording in glr
frappe.ui.form.on("Recording Data GLR", {
    steam_pressure_kgcm2: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.steam_pressure_kgcm2) {
            let now = frappe.datetime.now_time().substr(0, 5);
            frappe.model.set_value(cdt, cdn, "recording_time", now);
        }
    }
});

// anf to slurry storage  and fetch 
frappe.ui.form.on("Linking Jobcard", {
    jobcard: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.jobcard) return;

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Job Card",
                name: row.jobcard
            },
            callback: function(r) {
                if (!r.message) return;

                const source_jobcard = r.message;

                (source_jobcard.custom_batch || []).forEach(batch_row => {

                    // Add to custom_batch if field is visible
                    if (is_field_visible(frm, "custom_batch")) {
                        let b_row = frm.add_child("custom_batch");
                        b_row.batch = batch_row.batch;
                        b_row.quantity = source_jobcard.for_quantity;
                    }

                    // Add to custom_slurry_storage if field is visible
                    if (is_field_visible(frm, "custom_slurry_storage")) {
                        let s_row = frm.add_child("custom_slurry_storage");
                        s_row.batchlot_no = batch_row.batch;
                        s_row.job_card = row.jobcard;
                        s_row.anf_workstation = source_jobcard.workstation;
                    }

                    // Add to custom_homogenization_log_sheet1 if field is visible
                    if (is_field_visible(frm, "custom_homogenization_log_sheet1")) {
                        let h_row = frm.add_child("custom_homogenization_log_sheet1");
                        h_row.batchlot_no = batch_row.batch;
                    }

                });

                // Refresh only the visible table fields
                const fields_to_refresh = [];
                ["custom_batch", "custom_slurry_storage", "custom_homogenization_log_sheet1"].forEach(f => {
                    if (is_field_visible(frm, f)) fields_to_refresh.push(f);
                });
                frm.refresh_fields(fields_to_refresh);
            }
			
        });
    }
});

// filter for custom_job_card field (completed JCs in last 24h)
frappe.ui.form.on("Job Card", {
	setup(frm) {
		const grid = frm.get_field("custom_job_card")?.grid;
		if (!grid) return;
		const jobcard_field = grid.get_field("jobcard");
		if (!jobcard_field) return;
		jobcard_field.get_query = function () {
			return {
				query: "custom_manufacturing.doc_events.jobcard_queries.completed_jobcards_within_last_day",
			};
		};
	}
});

//anf from time , to time and duration
frappe.ui.form.on("Washing", {
    from_time(frm, cdt, cdn) {
		console.log("fr");
		
        calculate_duration(frm, cdt, cdn);
    },
    to_time(frm, cdt, cdn) {
        calculate_duration(frm, cdt, cdn);
    }
});
frappe.ui.form.on("Filteration", {
    from_time(frm, cdt, cdn) {
        calculate_duration(frm, cdt, cdn);
    },
    to_time(frm, cdt, cdn) {
        calculate_duration(frm, cdt, cdn);
    }
});
function calculate_duration(frm, cdt, cdn_or_row) {
    let row = typeof cdn_or_row === "string" ? locals[cdt][cdn_or_row] : cdn_or_row;
    if (!row) return;

    if (row.from_time && row.to_time) {
        let minutes = get_minutes_diff(row.from_time, row.to_time);

        row.duration = minutes;

        frm.refresh_field(cdt);
    }
}
let washing_filter_state = {
    table: "custom_washing", 
    field: "from_time"
};
function handle_washing_time_record(frm) {
    const now = frappe.datetime.now_time();
    const tables = ["custom_washing", "custom_filteration1"];
    let rows = frm.doc[washing_filter_state.table] || [];
    let last = rows.length ? rows[rows.length - 1] : null;
    let row;
    const isNewRow = !last || (washing_filter_state.field === "from_time" && last.to_time) || (!last.from_time && washing_filter_state.field === "to_time");
    row = isNewRow ? frm.add_child(washing_filter_state.table) : last;
    row[washing_filter_state.field] = now;
    frm.refresh_field(washing_filter_state.table);
    if (row.from_time && row.to_time) {
        calculate_duration(frm, washing_filter_state.table, row);
    }
    frappe.show_alert({
        message: `${washing_filter_state.table === "custom_washing" ? "Washing" : "Filteration"} ${capitalize(washing_filter_state.field.replace("_", " "))
} recorded: ${now}`,
        indicator: "green"
    });
    if (washing_filter_state.field === "from_time") {
        washing_filter_state.field = "to_time";
    } else {
        let nextIndex = (tables.indexOf(washing_filter_state.table) + 1) % tables.length;
        washing_filter_state.table = tables[nextIndex];
        washing_filter_state.field = "from_time";
    }
}
function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

//homogenization time filling
let homogenization_state = {
    table: "custom_homogenization_log_sheet1",
    field: "from_time"
};
function handle_homogenization_time_record(frm) {
    const now = frappe.datetime.now_time();
    let rows = frm.doc[homogenization_state.table] || [];
    let last = rows.length ? rows[rows.length - 1] : null;

    const isNewRow = !last || (homogenization_state.field === "from_time" && last.to_time) || (!last.from_time && homogenization_state.field === "to_time");
    let row = isNewRow ? frm.add_child(homogenization_state.table) : last;

    row[homogenization_state.field] = now;

    if (row.from_time && row.to_time) {
        calculate_duration(frm, homogenization_state.table, row);
    }
    frm.refresh_field(homogenization_state.table);
    frappe.show_alert({
        message: `Homogenization ${capitalize(homogenization_state.field)} recorded: ${now}`,
        indicator: "green"
    });
    homogenization_state.field = homogenization_state.field === "from_time" ? "to_time" : "from_time";
}
frappe.ui.form.on("Homogenization", {
    from_time(frm, cdt, cdn) {
        calculate_duration(frm, "custom_homogenization_log_sheet1", locals[cdt][cdn]);
    },
    to_time(frm, cdt, cdn) {
        calculate_duration(frm, "custom_homogenization_log_sheet1", locals[cdt][cdn]);
    }
});

// to update washing count in the slurry storage table
frappe.ui.form.on("Washing", {
    custom_washing_add: function(frm) {
        update_washing_count(frm);
    },
    custom_washing_remove: function(frm) {
        update_washing_count(frm);
    }
});
function update_washing_count(frm) {
    let count = frm.doc.custom_washing?.length || 0;

    (frm.doc.custom_slurry_storage || []).forEach((row, i) => {
        row.washing_count = count;
    });
    frm.refresh_field("custom_slurry_storage");
}
frappe.ui.form.on("Job Card", {
    refresh() {
        $(".layout-side-section, .form-sidebar").hide();
    }
});